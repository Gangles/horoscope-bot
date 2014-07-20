// import twitter library
// https://github.com/ttezel/twit
var Twit = require('twit');
var T = new Twit(require('./config.js'));

// search for the latest tweets containing "you will"
// https://dev.twitter.com/docs/api/1.1/get/search/tweets
var twitterSearch = {
	q: "%22you%20will%22",
	count: 40,
	lang: "en",
	result_type: "recent"
};

// avoid using slurs: https://github.com/dariusk/wordfilter/
var blacklist = [];
try {
	var fs = require('fs');
	var data = fs.readFileSync('blacklist.json', 'ascii');
	data = JSON.parse(data);
	blacklist = data.badwords;
	console.log("Blacklist initialized with " + blacklist.length + " words.")
} catch (err) {
	console.error("There was an error opening the blacklist file:");
	console.log(err);
	process.exit(1);
}

// global bot variables
var maxTwitterID = 0;
var recentTweets = [];
var starSign = Math.floor((Math.random() * 12));

function searchTwitter() {
	// initiate a twitter API search
	twitterSearch.since_id = maxTwitterID;
	T.get('search/tweets', twitterSearch, searchCallback);
}

function searchCallback( error, data, response ) {
	// twitter API callback with relevant tweets
	console.log(error, data);
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
	T.post('statuses/update', { status: message }, postCallback);
}

function postCallback( error, data, response ) {
	// twitter API callback from posting tweet
	console.log(error, data);
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
				maxTwitterID = tweet.id_str;
			}
	
			i--;
		}
		
		// if we're ready, send the tweet
		if ( divinations.length > 1 ) {
			// get two matched statements to post
			var first = divinations.shift();
			var second = divinations.shift();
			
			// record the 10 most recent matches
			recentTweets.push(first, second);
			while (recentTweets.length > 10) {
				recentTweets.shift();
			}
			
			// assemble the tweet and post it
			var tweet = getStarSignMessage( starSign++ );
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
	// general text patterns to avoid
	var toAvoid = [
		// avoid being insensitive
		"rest in peace",
		"you will be missed",
		"enter jannah",
		"allah",
		"ukraine",
		"israel",
		"west bank",
		"gaza",
		// avoid common tweets
		"follow me",
		"you will ever",
		"you will never see this",
		"face their own karma",
		"let you go or give up on you",
		"will attract a better next",
		// avoid threats
		"get pregnant and die",
		"you will die",
		"kill you",
		"will fuck you up"
	];

	for (var i = 0; i < toAvoid.length; i++) {
		if (text.toLowerCase().indexOf(toAvoid[i]) >= 0) {
			return 0;
		}
	}

	// the only case-sensitive rule...
	if (/RIP/.test(text)) {
		return 0;
	}
	
	// hacky way to remove links
	text = text.replace(/http/g, ".");
	
	// replace newlines with periods
	text = text.replace(/(\r\n|\n|\r)/gm, ".");
	
	// fix the broken ampersands twitter sends
	text = text.replace(/&amp;/g, "&");
	
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
	if (match !== null) {
		best = match[1].trim();
	}
	
	// avoid text we've already matched and recorded
	for (var i = 0; i < matches.length; i++) {
		var matched = matches[i].toLowerCase();
		if (matched.indexOf(best.toLowerCase()) >= 0) {
			return 0;
		}
	}
	
	// reject matches already found in this bot's recent tweets
	for (var i = 0; i < recentTweets.length; i++) {
		var recent = recentTweets[i].toLowerCase();
		if (recent.indexOf(best.toLowerCase()) >= 0) {
			return 0;
		}
	}
	
	// record appropriate matches
	var wordCount = best.split(" ").length;
	if ( best.length > 18 && best.length < 49 && wordCount > 2 && !isOffensive(best) ) {
		return best;
	}
	
	// didn't find a match
	return 0;
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

function isOffensive(text) {
	// detect any offensive word on the blacklist
	for (var i = 0; i < blacklist.length; i++) {
		if (text.toLowerCase().indexOf( blacklist[i] ) >= 0) {
			console.log( blacklist[i] + " is offensive." );
			return true;
		}
	}
	return false;
}

// try to post a tweet as soon as we run the program
searchTwitter();

// post again every 20 minutes
setInterval(searchTwitter, 1000 * 60 * 20);