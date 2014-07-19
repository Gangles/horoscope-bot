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

// global bot variables
var maxTwitterID = 0;
var starSign = Math.floor((Math.random() * 12);

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
			var tweet = getStarSignMessage( starSign );
			tweet += "You will " + divinations.shift() + ", ";
			tweet += "but you will " + divinations.shift() + ".";
			postTweet( tweet );
			++starSign;
		}
	} catch (e) {
		// Log oAuth errors if any.
		console.log("Parsing error:", e.toString());
	}
}

function findDivination(text, matches) {
	// avoid text we've already matched
	for (var i = 0; i < matches.length; i++) {
		if (text.toLowerCase().indexOf(matches[i]) >= 0) {
			return 0;
		}
	}
	
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
		// avoid threats
		"get pregnant and die",
		"you will die",
		"kill you"
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
	var re = /you will ([\w\s&'àèìòùáéíóúýâêîôûãñõäëïöüÿçßøåæœ]{10,140})(?:[$\r\n]|[^\w\s&'àèìòùáéíóúýâêîôûãñõäëïöüÿçßøåæœ])/mi;
	
	// find a substring that matches the regex
	var match = re.exec(text);
	var best = "";
	if (match !== null) {
		best = match[1].trim();
	}
	
	// record appropriate matches
	if ( best.length > 18 && best.length < 49 && best.split(" ").length > 2 && !isOffensive(best) ) {
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
	// avoid using slurs
	// list from https://github.com/dariusk/wordfilter/
	var blacklist = [
		"skank",
		"wetback",
		"bitch",
		"cunt",
		"dick",
		"douchebag",
		"dyke",
		"fag",
		"nigger",
		"nigga",
		"tranny",
		"trannie",
		"paki",
		"pussy",
		"retard",
		"slut",
		"titt",
		"tits",
		"whore",
		"hoes",
		"chink",
		"fatass",
		"shemale",
		"daygo",
		"dego",
		"dago",
		"gook",
		"kike",
		"kraut",
		"spic",
		"twat",
		"lesbo",
		"homo",
		"fatso",
		"lardass",
		"jap",
		"biatch",
		"tard",
		"gimp",
		"gyp",
		"chinaman",
		"chinamen",
		"golliwog",
		"crip",
		"raghead",
		"rape",
		"raping"
	];

	for (var i = 0; i < blacklist.length; i++) {
		if (text.toLowerCase().indexOf( blacklist[i] ) >= 0) {
			console.log( blacklist[i] + " is offensive." );
			return true;
		}
	}
	return false;
}

function encodeString(q) {
	// encode characters such as !, *, (), etc.
	var str = encodeURIComponent(q);
	str = str.replace(/!/g, '%21');
	str = str.replace(/\*/g, '%2A');
	str = str.replace(/\(/g, '%28');
	str = str.replace(/\)/g, '%29');
	str = str.replace(/'/g, '%27');
	return str;
}

// try to post a tweet as soon as we run the program
searchTwitter();

// post again every 15 minutes
setInterval(searchTwitter, 1000 * 60 * 15);