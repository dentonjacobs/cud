var _ = require('underscore');
var watch = require('watch');
var fs = require('fs');
var qfs = require('q-io/fs');
var sugar = require('sugar');
var newbase60 = require('newbase60');
var twitterAPI = require('node-twitter-api');
var version = require('./package.json').version;

var metadataMarker = '@@';
var inboxPath = './inbox/';
var draftsPath = './drafts/';
var siteMetadata = {};

var twitterOptions  = {
    consumer_key:        'kRiC56bX0UA04za5aeEmGw',
    consumer_secret:     'Kk2sJJi7TzLQJdmuh1TLtFSIf7fJOYgsdxARrPU',
    access_token:        '15998762-dIpvCIeWZD5udRwz5gQuX1oWiToPKjZ1Ze6TPNlw8',
    access_token_secret: 'MnOPrgxQhasLV3da0Ug0GI2WjAVzHnjnzzpnM8yO0',
    callback: ''
};

var watchOptions = {
	ignoreDotFiles: true,
	ignoreUnreadableDir: true,
};

var twitter = new twitterAPI(twitterOptions);

function postToTwitter() {

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
    file = file.endsWith('.md') ? file : file + '.md';
    var data = fs.readFileSync(file, {encoding: 'UTF8'});

    // Extract the pieces
    var lines = data.lines();
    var metadataLines = _.filter(lines, function (line) { return line.startsWith(metadataMarker); });
    var body = _.difference(lines, metadataLines).join('\n');

    return {metadata: metadataLines, body: body};
}

function testFile(file) {
	var lines = getLinesFromPost(file);
    var metadata = parseMetadata(lines['metadata']);

	_.each(metadata, function(metadataItem) {
		console.log('Item:' + metadataItem);
	});
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
watch.createMonitor(inboxPath, watchOptions, function(monitor) {
	init();
	console.log("Cud v" + version + " started");

	monitor.on("created", function(file, stat) {
		console.log("File created: " + file);
		testFile(file);
	})
	monitor.on("changed", function(file, prevStat, currentStat) {
		console.log("File changed: " + file);
	})
	monitor.on("removed", function(file, stat) {
		console.log("File removed: " + file);
	})
});