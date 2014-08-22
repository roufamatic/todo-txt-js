var TodoTxt = (function(){
	var reTrim = /^\s+|\s+$/g;
	var reSplitSpaces = /\s+/;
	var reFourDigits = /^\d{4}$/;
	var reTwoDigits = /^\d{2}$/;
	var rePriority = /^\([A-Z]\)$/;
	var reBlankLine = /^\s*$/;
	
	var parseFile = function(blob) {
		var lines = blob.split('\n');
		var output = [];
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if (reBlankLine.test(line)) continue;
			output.push(parseLine(line));
		}
		output.render = function() {
			var txt = '';
			for (var i = 0; i < this.length; i++) {
				if (txt !== '') txt += '\n';
				txt += this[i].render();
			}
			return txt;
		};
		
		return output;
	};
	
	var parseLine = function(line) {
		var output = {
			orig: line,
			priority: null,
			createdDate: null,
			isComplete: false,
			completedDate: null,
			contexts: [],
			projects: [],
			addons: {},
			text: '',
			render: function() {
				return renderLine(this);
			}
		};
		// Note: this is slightly different behavior than parseFile.
		// parseFile removes blank lines before sending them into this function.
		// However, if parseLine is called directly with blank input, it will return an empty todo item.
		// In other words, "parseLine()" functions like a line constructor.
		
		if (!line || reBlankLine.test(line)) return output;
		
		// Trim the line.
		line = line.replace(reTrim, '');
		if (line === '') return output;
		
		// Split it into tokens.
		var tokens = line.split(reSplitSpaces);
		
		// Start our state machine.
		var canBeComplete = true;
		var canBeCompletedDate = false;
		var canBePriority = true;
		var canBeCreatedDate = true;
		
		var tokenToDate = function(token) {
			var bits = token.split('-');
			if (bits.length !== 3) return null;
			var year = bits[0], month = bits[1], day = bits[2];
			
			var regexTest = reFourDigits.test(year) && reTwoDigits.test(month) && reTwoDigits.test(day);
			if (!regexTest) return null;
			
			var dtStr = bits.join('/'); // Slashes ensure local time is used, per http://blog.dygraphs.com/2012/03/javascript-and-dates-what-mess.html
			var dt = new Date(dtStr);
			if (dt === 'Invalid Date') return null;
			// Now make sure that javascript didn't interpret an invalid date as a date (e.g. 2014-02-30 can be reimagined as 2014-03-02)
			year = parseInt(year, 10);
			month = parseInt(month, 10);
			day = parseInt(day, 10);
			if (dt.getFullYear() !== year) return null;
			if (dt.getMonth() !== month - 1) return null;
			if (dt.getDate() !== day) return null;
			// Hooray, a valid date!
			return dt;
		};
		
		var tokenParser = function(token) {
			if (canBeComplete && token === 'x') {
				output.isComplete = true;
				// The next token cannot be isComplete.
				canBeComplete = false;
				// The next token can be completed date.
				canBeCompletedDate = true;
				return;
			}
			
			if (canBeCompletedDate) {
				var dt = tokenToDate(token);
				if (_.isDate(dt)) {
					output.completedDate = dt;
					canBeCompletedDate = false;
					return;
				}
			}
			
			if (canBePriority && rePriority.test(token)) {
				output.priority = token[1];
				canBeComplete = false;
				canBeCompletedDate = false;
				canBePriority = false;
				return;
			}
			
			if (canBeCreatedDate) {
				var dt = tokenToDate(token);
				if (_.isDate(dt)) {
					output.createdDate = dt;
					canBeComplete = false;
					canBeCompletedDate = false;
					canBePriority = false;
					canBeCreatedDate = false;
					return;
				}
			}
			
			if (token.length > 1 && token[0] === '@') {
				// It's a context!
				output.contexts.push(token);
			}
			else if (token.length > 1 && token[0] === '+') {
				// It's a project!
				output.projects.push(token);
			}
			else if (token.length > 2 && token.indexOf(':') > 0 && token.indexOf(':') < (token.length - 1)) {
				// It's an add-on!
				var bits = token.split(':');
				var tail = bits.splice(1);
				var key = bits[0];
				var val = tail.join(':'); // Colons beyond the first are just part of the value.
				if (!output.addons[key]) output.addons[key] = val;
				else if (!isArray(output.addons[key])) {
					var oldValue = output.addons[key];
					output.addons[key] = [oldValue, val];
				}
				else {
					output.addons[key].push(val);
				}
			}
			else {
				// It's just good old text.
				if (output.text !== '') output.text += ' ';
				output.text += token;
			}
			
			canBePriority = false;
			canBeComplete = false;
			canBeCompletedDate = false;
			canBeCreatedDate = false;
		};
		
		for (var i = 0; i < tokens.length; i++) {
			tokenParser(tokens[i]);
		}
		
		return output;
	};
	
	var toIsoDate = function(dt) {
		return dt.getFullYear() + '-' + zeropad(dt.getMonth() + 1, 2) + '-' + zeropad(dt.getDate(), 2);
	};
	var zeropad = function(num, len) { 
		var output = num.toString();
		while (output.length < len) output = '0' + output;
		return output;
	}
	var isArray = function(arg) {
		return Object.prototype.toString.call(arg) === '[object Array]'
	};
	
	var renderLine = function(todo) {
		var output = '';
		if (todo.isComplete) {
			output += 'x';
			if (todo.completedDate) output += ' ' + toIsoDate(todo.completedDate);
		}
		if (todo.priority) output += ' (' + todo.priority + ')';
		if (todo.createdDate) output += ' ' + toIsoDate(todo.createdDate);
		output += ' ' + todo.text;
		if (todo.projects.length > 0) output += ' ' + todo.projects.join(' ');
		if (todo.contexts.length > 0) output += ' ' + todo.contexts.join(' ');
		for (var k in todo.addons) {
			if (!todo.addons.hasOwnProperty(k)) continue;
			var val = todo.addons[k];
			if (!isArray(val)) val = [val];
			for (var i = 0; i < val.length; i++) {
				output += ' ' + k + ':' + val[i];
			}
		}
		return output.replace(reTrim, '');
	};
	
	
	var publicMethods = {
		parseFile: parseFile,
		parseLine: parseLine
	};

	return publicMethods;
})();
