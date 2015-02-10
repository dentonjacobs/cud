var _ = require('underscore');
var moment = require('moment');
var watch = require('watch');
var q = require('q');
var fs = require('fs');
var qfs = require('q-io/fs');
var sugar = require('sugar');
var newbase60 = require('newbase60');
var twitterAPI = require('node-twitter-api');
var version = require('./package.json').version;

var metadataMarker = '@@';
var inboxPath = './inbox/';
var draftsPath = './drafts/';
var postsRoot = './posts/';
var markdown_ext = '.md';
var siteMetadata = {};

var twitterOptions  = {
    consumer_key:        process.env.TWITTER_CONSUMER_KEY,
    consumer_secret:     process.env.TWITTER_CONSUMER_SECRET,
    access_token:        process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
};

var twitter = new twitterAPI(twitterOptions);

function postToTwitter() {
	// do something
	// but what?
}

function parseMetadata(lines) {
    var retVal = {};

    lines.each(function (line) {
        line = line.replace(metadataMarker, '');
        line = line.compact();
        if (line.has('=')) {
            var firstIndex = line.indexOf('=');
            retVal[line.first(firstIndex)] = line.from(firstIndex + 1);
        }
    });

    // NOTE: Some metadata is added in generateHtmlAndMetadataForFile().

    // Merge with site default metadata
    Object.merge(retVal, siteMetadata, false, function(key, targetVal, sourceVal) {
        // Ensure that the file wins over the defaults.
        console.log('overwriting "' + sourceVal + '" with "' + targetVal);
        return targetVal;
    });

    return retVal;
}

// Gets all the lines in a post and separates the metadata from the body
function getLinesFromPost(file) {
    file = file.endsWith(markdown_ext) ? file : file + markdown_ext;
    var data = fs.readFileSync(file, {encoding: 'UTF8'});

    // Extract the pieces
    var lines = data.lines();
    var metadataLines = _.filter(lines, function (line) { return line.startsWith(metadataMarker); });
    var body = _.difference(lines, metadataLines).join('\n');

    return {metadata: metadataLines, body: body};
}

function getDailyPostIndex(postDate) {
	var date = moment(postDate);
	var pathToPost = postsRoot + date.format("YYYY/MM/DD/");
	console.log('Path to post: ' + pathToPost);

	var mdCount = 1; // start with 1, as the current post is n+1
	var files = fs.readdirSync(pathToPost);

	_.each(files, function (file) {
		//console.log('file: ' + file);
		if (file.endsWith(markdown_ext)) {
			//console.log('Adding to count');
			mdCount++;
		}
	});

	return mdCount;
}

function GetDateAndShortLink(metadata) {
	var shortLink = '';
	var postDate = new Date();
	//var postDate = new Date(metadata['Date']);
	var type = metadata['PostType'];

	switch(type.toLowerCase()) {
		case 'audio':
			shortLink += '/a/';
			break;
		case 'article':
			shortLink += '/b/';
			break;
		case 'event':
			shortLink += '/e/';
			break;
		case 'note':
			shortLink += '/t'; // no trailing slash to reduce character count in tweets
			break;
		case 'photo':
			shortLink += '/p/';
			break;
		default:
			throw new error('Unsupport post type:' + type);
	}

	shortLink += newbase60.DateToSxg(postDate);

	var dailyPostIndex = getDailyPostIndex(postDate);
	shortLink += dailyPostIndex;
	return {
		"Date": postDate,
		"ShortLink": shortLink
	};
}

function createRedirect(file, metadata) {
	var pathToRedirect = '.' + metadata['ShortLink'];
	var content = "302\n" + file;

	return qfs.write(pathToRedirect, content);
}

function updateMetadata(file, metadata) {
	var dateAndShortLink = GetDateAndShortLink(metadata);
	console.log('ShortLink added: ' + dateAndShortLink.ShortLink);
	metadata['ShortLink'] = dateAndShortLink.ShortLink;
	metadata['Date'] = dateAndShortLink.Date;

	_.each(metadata, function(metadataItem) {
		console.log('Item:' + metadataItem);
	});	
}

function processFile(file) {
	var lines = getLinesFromPost(file);
    var metadata = parseMetadata(lines['metadata']);

	console.log('Updating metadata');	
    updateMetadata(file, metadata);
	console.log('Creating redirect.');
	//createRedirect(file, metadata);
}

function loadFile(file, completion) {
    fs.exists(file, function(exists) {
        if (exists) {
            fs.readFile(file, {encoding: 'UTF8'}, function (error, data) {
                if (!error) {
                    completion(data);
                }
            });
        }
    });
}

function init() {
	loadFile('defaultTags.html', function(data) {
    	siteMetadata = parseMetadata(data.split('\n'));
	});
}

/**********************************
* STARTUP
**********************************/

var watchOptions = {
	ignoreDotFiles: true,
	ignoreUnreadableDir: true,
};

watch.createMonitor(inboxPath, watchOptions, function(monitor) {
	init();
	console.log("Cud v" + version + " started");

	monitor.on("created", function(file, stat) {
		console.log("File created: " + file);
		processFile(file);
	})
	monitor.on("changed", function(file, prevStat, currentStat) {
		console.log("File changed: " + file);
	})
	monitor.on("removed", function(file, stat) {
		console.log("File removed: " + file);
	})
});
