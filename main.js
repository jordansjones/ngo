var optimist = require('optimist')
	.usage('Usage: go [option] value')
	// .boolean('v').alias('v', 'verbose').describe('v', 'Verbose mode')
	.string('s').alias('s', 'save').describe('s', 'Save current path to alias')
	.string('r').alias('r', 'remove').describe('r', 'Remove alias')
	.boolean('l').alias('l', 'list').describe('l', 'List aliases')
	.string('j').alias('j', 'jump').describe('j', 'Jump to location')
	.boolean('h').alias('h', 'help').describe('h', 'Show this help')
	// .boolean('version').describe('version', 'Show version')
	;
var args = optimist.argv;

var isDevMode = false;

var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	S = require('string'),
	_ = require('underscore');

S.clobberPrototype();

var NGO_DB_FILE = null;
var NGO_DB = null;

var isNullOrEmpty = function (v) {
	return v === null || v.isEmpty();
};

var inspectObject = function (o) {
	var idx = 1;
	var showHidden = false;
	var depth = 5;

	if (arguments[idx] && _.isBoolean(arguments[idx])) {
		showHidden = arguments[idx];
		idx += 1;
	}
	if (arguments[idx] && _.isNumber(arguments[idx])) {
		depth = arguments[idx];
	}
	util.debug(util.inspect(o, showHidden, depth, true));
};

var reportError = function (msg) {
	inspectObject(msg);
	console.error("ERROR: " + msg);
	process.exit(1);
};

var checkDirectory = function(dbFolder, cb) {
	fs.exists(dbFolder, function (exists) {
		if (!exists) {
			fs.mkdir(dbFolder, function (err) {
				if (err) {
					logger.debug("Error checkDirectory", err);
					reportError(err);
				}
				cb();
			});
		}
		else {
			cb();
		}
	});
};

var checkFileExists = function(isDev) {
	fs.exists(NGO_DB_FILE, function (exists) {
		if (exists && isDev) {
			fs.unlinkSync(NGO_DB_FILE);
			return checkFileExists(false);
		}
		if (exists) {
			readDbFile();
		}
		else {
			createDbFile(readDbFile);
		}
	});
};

var createDbFile = function (cb) {
	fs.open(NGO_DB_FILE, 'w', function (err, fd) {
		if (err) {
			reportError(err);
		}
		fs.close(fd, function (e) {
			if (e) {
				reportError(err);
			}
			cb();
		});
	});
};

var readDbFile = function () {
	fs.readFile(NGO_DB_FILE, function (err, data) {
		if (err) {
			reportError(err);
		}
		NGO_DB = data.length === 0 ? {} : JSON.parse(data.toString());
		processCliArgs();
	});
};

var writeDbFile = function () {
	var o = JSON.stringify(NGO_DB);
	var wstream = fs.createWriteStream(NGO_DB_FILE, {flags: 'w', encoding: 'utf8', mode: 0666});
	wstream.on('open', function () {
		wstream.end(o, 'utf8');
	});
	wstream.on('error', function (e) {
		wstream.destroy();
		reportError(e);
	});
};

var echo = function (msg) {
	util.puts(util.format('echo "%s"', msg));
};

var cd = function(path) {
	util.puts(util.format('cd "%s"', path));
};

var writeVersion = function () {
	echo("writeVersion");
};

var listAliases = function () {
	_.each(NGO_DB, function (val, key) {
		echo(util.format("%s : %s", key, val));
	});
};

var saveAlias = function(alias) {
	var cwd = process.cwd();
	NGO_DB[alias] = process.cwd();
	writeDbFile();
};

var removeAlias = function(alias) {
	if (NGO_DB[alias]) {
		NGO_DB[alias] = null;
		delete NGO_DB[alias];
		writeDbFile();
	}
};

var jumpToAlias = function(alias) {
	if (NGO_DB[alias]) {
		cd(NGO_DB[alias]);
	}
};

var processCliArgs = function () {
	var rawArgs = args._;
	if (args.version) {
		writeVersion();
	}
	else if (args.list) {
		listAliases();
	}
	else if (args.save && !isNullOrEmpty(args.save)) {
		saveAlias(args.save);
	}
	else if (args.remove && !isNullOrEmpty(args.remove)) {
		removeAlias(args.remove);
	}
	else if (args.jump || rawArgs[0]) {
		var alias = args.jump || rawArgs[0];
		jumpToAlias(alias);
	}
	else {
		optimist.showHelp();
	}
};

var NGO_HOME=process.env['NGO_HOME'];
if (!NGO_HOME) {
	reportError("NGO_HOME is not defined as an environment variable.");
}
NGO_HOME = path.resolve(NGO_HOME);
NGO_DB_FILE = path.join(NGO_HOME, "ngo.db");

checkDirectory(NGO_HOME, function () {
	checkFileExists(isDevMode);
});
