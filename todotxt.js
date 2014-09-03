var TodoTxt = (function () {
    var SORT_ASC = 'asc';
    var SORT_DESC = 'desc';
    var reTrim = /^\s+|\s+$/g;
	var reSplitSpaces = /\s+/;
	var reFourDigits = /^\d{4}$/;
	var reTwoDigits = /^\d{2}$/;
	var rePriority = /^\([A-Z]\)$/;
	var reBlankLine = /^\s*$/;

	var parseFile = function(blob) {
	    var getLineNumber = function (task) {
	        for (var j = 0; j < items.length; j++) {
	            if (items[j].id() === task.id()) return j + 1;
	        }
	        return 0;
	    };

	    var lines = blob.split('\n');
		var items = [];
		var output = {};
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if (reBlankLine.test(line)) continue;
			items.push(parseLineInternal(line, getLineNumber));
		}
		output.render = function(query, sortFields) {
		    var itemsToRender = output.items(query, sortFields);

		    var txt = '';
		    for (var i = 0; i < itemsToRender.length; i++) {
				if (txt !== '') txt += '\n';
				txt += itemsToRender[i].render();
			}
			return txt;
		};
		output.items = function(query, sortFields) {
			// A query is an AND search -- all properties in that object must be found on the item for the item to match.
			// Query property values may be functions. In this case, the property value for each item will be passed into the function,
			// and the function should return a boolean indicating if the item matches or not. 
		    
			var output = [];
			if (!query) query = {};
			for (var i = 0; i < items.length; i++) { 
				var item = items[i];
				if (isItemInQuery(item, query)) output.push(item);
			}

			if (isArray(sortFields)) {
			    // Validate the sort fields.
                for (var i = 0; i < sortFields.length; i++) {
                    var sort = sortFields[i];
                    if (typeof sort === 'string') {
                        sortFields[i] = sort = { field: sort, direction: SORT_ASC };
                    }
                    if (!sort.field) {
                        throw new Error('Invalid sort ' + sort);
                    }
                    var validFields = ['priority', 'createdDate', 'completedDate', 'isComplete'];
                    if (validFields.indexOf(sort.field) === -1) {
                        throw new Error('Cannot sort by this field: ' + sort.field);
                    }
                    if (sort.direction !== SORT_DESC) sort.direction = SORT_ASC;
                }

			    var sortError = null;
			    var compare = function (a, b, sort) {
                    var aVal = a[sort.field]();
                    var bVal = b[sort.field]();

			        var sortResult = (function() {
			            if (aVal === bVal) return 0;

			            // Reminder: we validated sort.field above, so default can cover all string sorting cases.
			            switch (sort.field) {
			            case 'isComplete':
			                if (sort.direction === SORT_DESC) {
			                    return aVal ? 1 : -1;
			                }
			                return aVal ? -1 : 1;
			            case 'createdDate':
			            case 'completedDate':
			                // put nulls at the bottom regardless of whether we sort ascending or descending.
			                if (aVal === null) return 1;
			                if (bVal === null) return -1;
			                if (aVal.getTime() === bVal.getTime()) return 0;
			                if (sort.direction === SORT_DESC) {
			                    return aVal < bVal ? 1 : -1;
			                }
			                return aVal < bVal ? -1 : 1;
			            case 'priority':
			                // nulls go at the end when ascending, and at the beginning when descending.
			                if (aVal === null) return sort.direction === SORT_DESC ? -1 : 1;
			                if (bVal === null) return sort.direction === SORT_DESC ? 1 : -1;

			                if (sort.direction === SORT_DESC) {
			                    return aVal < bVal ? 1 : -1;
			                }
			                return aVal < bVal ? -1 : 1;
			            default:
			                throw new Error('Unhandled sort.field ' + sort.field);
			            }
			        })();
			        return sortResult;
			    }
			    var sorter = function (a, b) {
			        try {
			            for (var i = 0; i < sortFields.length; i++) {
			                var sortResult = compare(a, b, sortFields[i]);
			                if (sortResult !== 0) return sortResult;
			            }
			        } catch (e) {
			            sortError = e;
			            return 0;
			        }
			        // If we're here, it means the two items sorted identically. Do one last check of the item number
			        return a.lineNumber() < b.lineNumber() ? -1 : 1;

			    };
			    output.sort(sorter);
			    if (sortError) throw new Error(sortError);
			}
			return output;
		};
		
		output.length = items.length;

	    output.removeItem = function(itemToRemove, allMatches) {
	        if (typeof itemToRemove.render === 'function') itemToRemove = itemToRemove.render();
	        // Copy the array.
	        var newItems = [];
	        for (var i = 0; i < items.length; i++) {
	            newItems[i] = items[i];
	        }
	        var spliceIndex = 0;
            for (var i = 0; i < newItems.length; i++) {
                if (newItems[i].render() === itemToRemove) {
                    items.splice(spliceIndex, 1);
                    if (!allMatches) break;
                } else {
                    spliceIndex++;
                }
            }
	        output.length = items.length;
	    };

	    output.addItem = function(item) {
	        if (typeof item.render === 'function') item = item.render();
	        item = parseLineInternal(item, getLineNumber);
	        if (!item.createdDate()) item.setCreatedDate(new Date());

	        items.push(item);
	        output.length = items.length;
	        return item;
	    };
		return output;
	};

	var isItemInQuery = function(item, query) {
		for (var k in query) {
			if (!query.hasOwnProperty(k)) continue;
			if (!item.hasOwnProperty(k)) throw new Error('This property is invalid for query: ' + k);
			var queryProp = query[k];
			var itemProp = item[k]();
			var queryPropType = 'direct';
			if (typeof queryProp === 'function') queryPropType = 'function';
			else if (isArray(queryProp)) queryPropType = 'containsAll';
			
			switch (queryPropType) {
				case 'function':
					// Pass the property value into the function. If it returns false, go home. If true, move onto the next property.
					if (!queryProp(itemProp)) return false;
					break;
				case 'containsAll':
					// Make sure the source is an array as well. If not, throw.
					if (!isArray(itemProp)) throw new Error('Cannot pass array for non-array property');
					
					// Make sure each and every item in the query is also in the item -- an AND search.
					// (To do an OR search, use the function capability above and write your own comparer.)
					for (var i = 0; i < queryProp.length; i++) {
						var foundIt = false;
						for (var j = 0; j < itemProp.length; j++) {
							if (queryProp[i] === itemProp[j]) {
								foundIt = true;
								break;
							}
						}
						if (!foundIt) return false;
					}
					break;
			    case 'direct':
			        if (isDate(queryProp) && isDate(itemProp)) {
			            return isSameCalendarDate(queryProp,itemProp);
                    }
					if (queryProp !== itemProp) return false;
					
					break;
				default:
					throw new Error('unexpected queryPropType: ' + queryPropType);
			}
			
		}
		return true;
	};
	
	var parseLineInternal = function (line, lineNumberGetter) {
	    var parseValues = {
	        id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	            return v.toString(16);
	        }),
	        priority: null,
	        createdDate: null,
	        isComplete: false,
	        completedDate: null,
	        contexts: [],
	        projects: [],
	        addons: {},
	        textTokens: [],
	    };
		
        parseValues.makePublic = function() {
            return {
                id: function () { return parseValues.id; },
                priority: function () { return parseValues.priority; },
                createdDate: function () { return parseValues.createdDate; },
                isComplete: function () { return parseValues.isComplete; },
                completedDate: function () { return parseValues.completedDate; },
                contexts: function () { return parseValues.contexts; },
                projects: function () { return parseValues.projects; },
                addons: function () { return parseValues.addons; },
                textTokens: function () { return parseValues.textTokens; },
                lineNumber: function () { return lineNumberGetter(this); },
                render: function () { return line; },
                completeTask: function () {
                    if (parseValues.isComplete) return;
                    parseValues.isComplete = true;
                    parseValues.completedDate = new Date();
                    line = 'x ' + toIsoDate(parseValues.completedDate) + ' ' + line;
                },
                uncompleteTask: function () {
                    if (!parseValues.isComplete) return;
                    parseValues.isComplete = false;
                    var hadCompletedDate = (parseValues.completedDate !== null);
                    parseValues.completedDate = null;
                    var arr = line.split(' ');
                    arr.splice(0, hadCompletedDate ? 2 : 1);
                    line = arr.join(' ');
                },
                setCreatedDate: function (dt) {
                    if (!isDate(dt)) dt = new Date();
                    dt = stripTime(dt);
                    var targetIndex = 0;
                    var shouldInsertAtIndex = parseValues.createdDate === null;
                    if (parseValues.priority) targetIndex++;
                    if (parseValues.completedDate) targetIndex++;
                    if (parseValues.isComplete) targetIndex++;
                    var arr = line.split(' ');
                    arr.splice(targetIndex, shouldInsertAtIndex ? 0 : 1, toIsoDate(dt));
                    line = arr.join(' ');
                }
            };
        };

		
		// Note: this is slightly different behavior than parseFile.
		// parseFile removes blank lines before sending them into this function.
		// However, if parseLine is called directly with blank input, it will return an empty todo item.
		// In other words, "parseLine()" functions like a line constructor.
		
		if (!line || reBlankLine.test(line)) return parseValues.makePublic();
		
		// Trim the line.
		line = line.replace(reTrim, '');
		if (line === '') return parseValues.makePublic();
		
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
			if (dt.toString() === 'Invalid Date') return null;
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
				parseValues.isComplete = true;
				// The next token cannot be isComplete.
				canBeComplete = false;
				// The next token can be completed date.
				canBeCompletedDate = true;
				return;
			}
			
			if (canBeCompletedDate) {
				var dt = tokenToDate(token);
				if (isDate(dt)) {
					parseValues.completedDate = dt;
					canBeCompletedDate = false;
					return;
				}
			}
			
			if (canBePriority && rePriority.test(token)) {
				parseValues.priority = token[1];
				canBeComplete = false;
				canBeCompletedDate = false;
				canBePriority = false;
				return;
			}
			
			if (canBeCreatedDate) {
				var dt = tokenToDate(token);
				if (isDate(dt)) {
					parseValues.createdDate = dt;
					canBeComplete = false;
					canBeCompletedDate = false;
					canBePriority = false;
					canBeCreatedDate = false;
					return;
				}
			}
			
			if (token.length > 1 && token[0] === '@') {
				// It's a context!
				parseValues.contexts.push(token);
			}
			else if (token.length > 1 && token[0] === '+') {
				// It's a project!
				parseValues.projects.push(token);
			}
			else if (token.length > 2 && token.indexOf(':') > 0 && token.indexOf(':') < (token.length - 1)) {
				// It's an add-on!
				var bits = token.split(':');
				var tail = bits.splice(1);
				var key = bits[0];
				var val = tail.join(':'); // Colons beyond the first are just part of the value.
				if (!parseValues.addons[key]) parseValues.addons[key] = val;
				else if (!isArray(parseValues.addons[key])) {
					var oldValue = parseValues.addons[key];
					parseValues.addons[key] = [oldValue, val];
				}
				else {
					parseValues.addons[key].push(val);
				}
			}
			else {
				// It's just good old text.
				parseValues.textTokens.push(token);
			}
			
			canBePriority = false;
			canBeComplete = false;
			canBeCompletedDate = false;
			canBeCreatedDate = false;
		};
		
		for (var i = 0; i < tokens.length; i++) {
			tokenParser(tokens[i]);
		}
		
		// Return functions to keep the item immutable.
		var output = parseValues.makePublic();
		
		return output;
	};
	
	var toIsoDate = function(dt) {
		var zeropad = function(num, len) { 
			var output = num.toString();
			while (output.length < len) output = '0' + output;
			return output;
		}
		return dt.getFullYear() + '-' + zeropad(dt.getMonth() + 1, 2) + '-' + zeropad(dt.getDate(), 2);
	};

	var isArray = function(arg) {
	    return Array.isArray ? Array.isArray(arg) : Object.prototype.toString.call(arg) === '[object Array]';
	};

    var isDate = function(value) {
        return (value && typeof value == 'object' && toString.call(value) == '[object Date]') || false;
    };

    var isSameCalendarDate = function (dt1, dt2) {
        return dt1.getFullYear() === dt2.getFullYear() &&
            dt1.getMonth() === dt2.getMonth() &&
            dt1.getDate() === dt2.getDate();
    };

    var stripTime = function(dt) {
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };

	var publicMethods = {
	    SORT_ASC: SORT_ASC,
	    SORT_DESC: SORT_DESC,
	    parseFile: parseFile,
	    parseLine: function(line) {
	        return parseLineInternal(line, 0);
	    }
	};

	return publicMethods;
})();
