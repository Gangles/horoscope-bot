// import twitter library: https://github.com/ttezel/twit
var Twit = require('twit');
var T = new Twit(require('./config.js'));

// search for the latest tweets containing "you will"
// https://dev.twitter.com/docs/api/1.1/get/search/tweets
var twitterSearch = {
	q: "%22you%20will%22",
	count: 50,
	lang: "en",
	result_type: "mixed"
};

// avoid using slurs: https://github.com/dariusk/wordfilter/
var blacklist = [];
var toAvoid = [];
try {
	var fs = require('fs');
	var data = fs.readFileSync('blacklist.json', 'utf8');
	data = JSON.parse(data);
	blacklist = data.badwords;
	toAvoid = data.avoidphrase;
	console.log( "Blacklist initialized:" );
	console.log( blacklist.length + " words & " + toAvoid.length + " phrases.");
} catch (err) {
	console.log("Error opening blacklist file:", err);
	process.exit(1);
}

// fuzzy string matching: https://github.com/Glench/fuzzyset.js
require('fuzzyset.js');

// global bot variables
var DO_TWEET = true;
var REPEAT_MEMORY = 100;
var maxTwitterID = 0;
var recentTweets = [];

function waitToBegin() {
	// schedule tweet every hour on the :15
	var d = new Date();
	target = (d.getMinutes() < 15)? 15 : 75;
	var timeout = 60 - d.getSeconds();
	timeout += (target - d.getMinutes() - 1) * 60;

	// heroku scheduler runs every 10 minutes
	console.log("Wait " + timeout + " seconds for next tweet");
	if (timeout < 10 * 60)
		setTimeout(getRecentTweets, timeout * 1000);
	else
		process.exit(0);
}

function getRecentTweets() {
	// initiTalize the recent tweet list
	var selfTimeline = {screen_name : 'HoroscopeBot', count : 100};
	T.get('statuses/user_timeline', selfTimeline, recentCallback);
}

function recentCallback( error, data, response ) {
	if ( response.statusCode == 200 && !error) {
		// record recently tweeted phrases
		for (var i = 0; i < data.length; ++i)
		{
			var text = data[i].text;
			var divination = text.substr(text.indexOf(":") + 11);
			recentTweets.push.apply(recentTweets, divination.split(", but you will "));
			if (maxTwitterID < data[i].id) maxTwitterID = data[i].id;
		}

		// post a new tweet
		searchTwitter();
	}
	else {
		console.log("Self timeline error:", error);
	}
}

function searchTwitter() {
	// initiate a twitter API search
	twitterSearch.since_id = maxTwitterID;
	T.get('search/tweets', twitterSearch, searchCallback);
}

function searchCallback( error, data, response ) {
	// twitter API callback with relevant tweets
	if ( response.statusCode == 200 && !error) {
		parseTweets( data.statuses );
	}
	else {
		console.log("Search error:", error);
	}
}

function postTweet( message ) {
	// post a new status to the twitter API
	console.log( "Posting tweet:", message );
	if (DO_TWEET) {
		T.post('statuses/update', { status: message }, postCallback);
	}
}

function postCallback( error, data, response ) {
	// twitter API callback from posting tweet
	if ( response.statusCode == 200 && !error) {
		console.log("Post tweet success!");
	}
	else {
		console.log("Post tweet error:", error);
	}
}

function parseTweets( statuses )
{
	try {
		// loop through every given status
		var divinations = [];
		var i = statuses.length - 1;
		while ( i >= 0 && divinations.length < 2 ) {
			// extract phrases from the tweet
			var tweet = statuses[i];
			var text;
			if( tweet.hasOwnProperty('retweeted_status') ) {
				text = tweet.retweeted_status.text;
			} else {
				text = tweet.text;
			}
			var match = findDivination(text, divinations);
			
			// if we found a match, record it
			if (match != 0) {
				divinations.push(match);
				maxTwitterID = tweet.id;
			}
	
			i--;
		}
		
		// if we're ready, send the tweet
		if ( divinations.length > 1 ) {
			// get two matched statements to post
			var first = divinations.shift();
			var second = divinations.shift();
			
			// record the most recent matches
			recentTweets.push(first, second);
			while (recentTweets.length > REPEAT_MEMORY) {
				recentTweets.shift();
			}
			
			// assign the star sign
			var d = new Date();
			var starSign = d.getHours() * 2;
			if (d.getMinutes() > 30) ++starSign;

			// assemble the tweet and post it
			var tweet = getStarSignMessage( starSign );
			tweet += "You will " + first + ", ";
			tweet += "but you will " + second + ".";
			postTweet( tweet );
		}
	} catch (e) {
		// Log oAuth errors if any.
		console.log("Parsing error:", e.toString());
	}
}

function findDivination(text, matches) {	
	// avoid certain phrases altogether
	if (isOffensive(text, toAvoid)) return 0;

	// a couple of case-sensitive words to avoid
	if (/RIP/.test(text)) return 0;
	if (/AIDS/.test(text)) return 0;
	
	// hacky way to remove links
	text = text.replace(/http/g, ".");
	
	// replace newlines with periods
	text = text.replace(/(\r\n|\n|\r)/gm, ".");
	
	// fix the ampersands
	text = text.replace(/&amp;mp;/g, "&");
	text = text.replace(/&amp;/g, "&");
	
	// fix angle brackets too
	text = text.replace(/&lt;/g, "<");
	text = text.replace(/&gt;/g, ">");
	
	// find all hashtags
	var hashtags;
	var tagRE = /#([\w]+)[$\W]/;
	while ((hashtags = tagRE.exec(text)) !== null) {
		if (hashtags[1].length > 10) {
			// disregard tweets with long hashtags
			return 0;
		} else {
			// replace short hashtags with the word
			var thisTag = new RegExp("#" + hashtags[1], "g");
			text = text.replace(thisTag, hashtags[1]);
			
			// reset the regex matching
			tagRE.lastIndex = 0;
		}
	}

	// match every character after "you will" until punctuation or the end of input
	var re = /you will ([\w\s\/&'’àèìòùáéíóúýâêîôûãñõäëïöüÿçßøåæœ]{10,140})(?:[$\r\n]|[^\w\s\/&'’àèìòùáéíóúýâêîôûãñõäëïöüÿçßøåæœ])/mi;
	
	// find a substring that matches the regex
	var match = re.exec(text);
	var best = "";
	if (match !== null) best = match[1].trim();
	
	// enforce a string length range
	if (best.length < 19 || best.length > 48) return 0;
	
	// enforce a minimum word count
	if (best.split(" ").length < 3) return 0;
	
	// reject text too similar to what's already matched & recorded
	if (fuzzyMatch(best, matches, 0.5)) return 0;
	
	// reject matches already found in this bot's recent tweets
	if (fuzzyMatch(best, recentTweets, 0.5)) return 0;
	
	// reject offensive terms
	if (isOffensive(best, blacklist)) return 0;
	
	// didn't find a match
	return best;
}

function getStarSignMessage(sign) {
	switch (sign % 12) {
		case 0:
			return "ARIES ♈: ";
		case 1:
			return "TAURUS ♉: ";
		case 2:
			return "GEMINI ♊: ";
		case 3:
			return "CANCER ♋: ";
		case 4:
			return "LEO ♌: ";
		case 5:
			return "VIRGO ♍: ";
		case 6:
			return "LIBRA ♎: ";
		case 7:
			return "SCORPIO ♏: ";
		case 8:
			return "SAGITTARIUS ♐: ";
		case 9:
			return "CAPRICORN ♑: ";
		case 10:
			return "AQUARIUS ♒: ";
		case 11:
			return "PISCES ♓: ";
	}
}

function fuzzyMatch(term, textArray, threshold) {
	// find fuzzy matches for the term in the given set
	if (textArray.length == 0) return false;
	var matches = FuzzySet(textArray).get(term);
	if (matches !== null) {
		for (var i = 0; i < matches.length; ++i) {
			if (matches[i][0] > threshold) return true;
		}
	}
	return false;
}

function isOffensive(text, list) {
	// detect any offensive word on the blacklist
	for (var i = 0; i < list.length; ++i) {
		if (text.toLowerCase().indexOf( list[i] ) >= 0) {
			return true;
		}
	}
	return false;
}

// start scheduling tweets
waitToBegin();