function start() {
	// insert twitter API keys here
	var TWITTER_CONSUMER_KEY = "AAAABBBBCCCC";
	var TWITTER_CONSUMER_SECRET = "DDDDEEEEFFFF";
	
	// store API information
	ScriptProperties.setProperty("CONSUMER_KEY", TWITTER_CONSUMER_KEY);
	ScriptProperties.setProperty("CONSUMER_SECRET", TWITTER_CONSUMER_SECRET);

	// store bot information
	ScriptProperties.setProperty("FIRST_DIVINATION", 0);
	ScriptProperties.setProperty("SECOND_DIVINATION", 0);
	ScriptProperties.setProperty("STAR_SIGN", 0);

	// ID of the last tweet read by the bot
	ScriptProperties.setProperty("MAX_TWITTER_ID", 0);

	// delete existing triggers, if any
	var triggers = ScriptApp.getScriptTriggers();
	for (var i = 0; i < triggers.length; i++) {
		ScriptApp.deleteTrigger(triggers[i]);
	}

	// look for new tweets every 15 minutes
	ScriptApp.newTrigger("fetchTweets").timeBased().everyMinutes(15).create();
}

function fetchTweets() {
	// use oAuth with twitter API 1.1 to connect
	var oauthConfig = UrlFetchApp.addOAuthService("twitter");
	oauthConfig.setAccessTokenUrl("https://api.twitter.com/oauth/access_token");
	oauthConfig.setRequestTokenUrl("https://api.twitter.com/oauth/request_token");
	oauthConfig.setAuthorizationUrl("https://api.twitter.com/oauth/authorize");
	oauthConfig.setConsumerKey(ScriptProperties.getProperty("CONSUMER_KEY"));
	oauthConfig.setConsumerSecret(ScriptProperties.getProperty("CONSUMER_SECRET"));

	// set up a search for tweets
	var search = "https://api.twitter.com/1.1/search/tweets.json?";
	search = search + "q=%22you%20will%22&lang=en";
	search = search + "&since_id=" + ScriptProperties.getProperty("MAX_TWITTER_ID");
	var options = {
		"method": "get",
		"oAuthServiceName": "twitter",
		"oAuthUseToken": "always"
	};

	try {
		// Fetch the twitter search results and look for matches
		var result = UrlFetchApp.fetch(search, options);
		if( result.getResponseCode() === 200 ) {
			var data = Utilities.jsonParse( result.getContentText() );
			if (data) {
				for (var i = data.statuses.length - 1; i >= 0; i--) {
					// extract phrases from the tweet
					var tweet = data.statuses[i];
					var matched = findDivination( tweet.text );
					
					// make sure we don't reuse tweets
					var mostRecent = ScriptProperties.getProperty( "MAX_TWITTER_ID" );
					if( matched && parseInt( tweet.id_str ) > parseInt( mostRecent ) )
					{
						ScriptProperties.setProperty( "MAX_TWITTER_ID", tweet.id_str );
					}
				}
			}
		}
	} catch (e) {
		// Log oAuth errors if any.
		Logger.log(e.toString());
	}

	var first = ScriptProperties.getProperty("FIRST_DIVINATION");
	var second = ScriptProperties.getProperty("SECOND_DIVINATION");
	
	if ( first != 0 && second != 0 ) {
		// if we're ready, send the tweet
		var sign = parseInt( ScriptProperties.getProperty("STAR_SIGN") );
		var tweet = getStarSignMessage(sign);
		tweet += "You will " + first + ", ";
		tweet += "but you will " + second + ".";
		sendTweet( tweet );

		// reset local variables
		ScriptProperties.setProperty( "FIRST_DIVINATION",  0 );
		ScriptProperties.setProperty( "SECOND_DIVINATION", 0 );
		ScriptProperties.setProperty( "STAR_SIGN", sign + 1 );
	}
}

function findDivination(text) {
	// general text patterns to avoid
	// either insensitive or too common
	var toAvoid = [
		"rest in peace",
		"you will be missed",
		"follow me",
		"you will ever",
		"you will never see this"
	];

	for (var i = 0; i < toAvoid.length; i++) {
		if (text.toLowerCase().indexOf(toAvoid[i]) >= 0) {
			return false;
		}
	}

	// the only case-sensitive rule...
	if (/RIP/.test(text)) {
		return false;
	}
	
	// hacky way to remove links
	text = text.replace(/http/g, ".");
	
	// replace newlines with periods
	text = text.replace(/(\r\n|\n|\r)/gm, ".");
	
	// find all hashtags
	var hashtags;
	var tagRE = /#([\w]+)[$\W]/;
	while ((hashtags = tagRE.exec(text)) !== null) {
		var thisTag = new RegExp("#" + match[1], "g");
		if (match[1].length > 10) {
			// disregard tweets with long hashtags
			return false;
		} else {
			// replace short hashtags with the word
			text = text.replace(thisTag, match[1]);
			
			// reset the regex matching
			tagRE.lastIndex = 0;
		}
	}

	// match every non-punctuation after "you will"
	var re = /you will ([\w\s&'àèìòùáéíóúýâêîôûãñõäëïöüÿçßøåæœ]{10,140})/gi;
	
	// find the longest regex match
	var matches;
	var best = "";
	while ((matches = re.exec(text)) !== null) {
		var thisMatch = matches[1].trim();
		if (thisMatch.length > best.length) {
			best = thisMatch;
		}
	}
	
	// record appropriate matches
	if ( best.length > 18 && best.length < 49 && best.split(" ").length > 2 && !isOffensive(best) ) {
		var first = ScriptProperties.getProperty("FIRST_DIVINATION");
		var second = ScriptProperties.getProperty("SECOND_DIVINATION");

		if (first == 0) {
			ScriptProperties.setProperty( "FIRST_DIVINATION", best );
			return true;
		} else if (second == 0 && first.localeCompare( best ) != 0) {
			ScriptProperties.setProperty( "SECOND_DIVINATION", best );
			return true;
		}
	}
	
	// didn't find a match or already full
	return false;
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
		"trannies",
		"paki",
		"pussy",
		"retard",
		"slut",
		"titt",
		"tits",
		"wop",
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
		"raghead"
	];

	for (var i = 0; i < blacklist.length; i++) {
		if (text.toLowerCase().indexOf( blacklist[i] ) >= 0) {
			Logger.log( blacklist[i] + " is offensive." );
			return true;
		}
	}
	return false;
}

function sendTweet(tweet) {
	try {
		// write to a local google doc
		var doc = DocumentApp.openById('GGGGHHHHIIIIJJJJ');
		doc.appendParagraph(tweet);

		// post the tweet
		var options = {
			"method": "POST",
			"oAuthServiceName": "twitter",
			"oAuthUseToken": "always"
		};
		var status = "https://api.twitter.com/1.1/statuses/update.json";
		status = status + "?status=" + encodeString( tweet );
		var result = UrlFetchApp.fetch(status, options);
	} catch (e) {
		Logger.log(e.toString());
	}
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