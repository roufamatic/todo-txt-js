describe('TodoTxt.create',function(){
    it("Create an object without any content", function(){
        var todo = TodoTxt.create();
        expect(todo.length).toBe(0);
    });
    it("Add todo's after init", function(){
        var todo = TodoTxt.create();
		var item1 = 'Task1';
		var item2 = 'Task2';
		todo.addItem(item1);
		todo.addItem(item2);
        
		expect(todo.length).toBe(2);
		expect(todo.items().length).toBe(2);
    });
});
describe('TodoTxt.parseFile', function() {
	it("generates an object from a blob of text", function() {
		var testFile = 'Task1\nTask2';
		var output = TodoTxt.parseFile(testFile);
		expect(output.length).toBe(2);
		expect(output.items().length).toBe(2);
	});
	it("ignores blank lines", function() {
		var testFile = '\nTask1\n   \n\t\nTask2\n \n';
		var output = TodoTxt.parseFile(testFile);
		expect(output.length).toBe(2);
		expect(output.items().length).toBe(2);
	});
	it("renders todos as text", function() {
		var testFile = 'Task1\nTask2';
		expect(TodoTxt.parseFile(testFile).render()).toBe(testFile);
	});
    it("renders todos using a query", function() {
        var testFile = 'abc\ndef\nx nonono\nghi';
        expect(TodoTxt.parseFile(testFile).render({ isComplete: false })).toBe('abc\ndef\nghi');
    });
	it("fetches items using a function", function() {
		var testFile = 'Task1\nTask2';
		expect(_.isArray(TodoTxt.parseFile(testFile).items())).toBeTruthy();
	});
	it("fetches items using a query", function() {
		var testFile = '@ctxt1 @ctxt2 text1 +prj1 +prj2\n' + 
			'(P) 2014-02-02 @ctxt1 text2\n' + 
			'x @ctxt2 +prj1 text1 text3';
	
		var todos = TodoTxt.parseFile(testFile);
		
		var completed = todos.items({ isComplete: true });
		expect(completed.length).toBe(1);
		
		var ctxt1 = todos.items({ contexts: ['@ctxt1'] });
		expect(ctxt1.length).toBe(2);
		
		var ctxt1and2 = todos.items({contexts: ['@ctxt1','@ctxt2']});
		expect(ctxt1and2.length).toBe(1);
		
		var ctxt1or2 = todos.items({contexts: function(contexts) { return _.contains(contexts, '@ctxt1') || _.contains(contexts, '@ctxt2'); }});
		expect(ctxt1or2.length).toBe(3);
		
		var text1 = todos.items({textTokens:['text1']});
		expect(text1.length).toBe(2);
		
		var hasPrio = todos.items({priority:function(priority) { return priority !== null; }});
		expect(hasPrio.length).toBe(1);
		
		var multi = todos.items({ projects: ['+prj1'], contexts: ['@ctxt1', '@ctxt2']});
		expect(multi.length).toBe(1);

	    var testDate = new Date('2/2/2014 15:33'); // Making sure the time is lopped.
		var dates = todos.items({ createdDate: testDate });
	    expect(dates.length).toBe(1);
	});
    it("removes items when asked", function() {
        var testFile = 'item1\nitem2\nitem3';
        var todos = TodoTxt.parseFile(testFile);
        var item2 = todos.items()[1];
        expect(item2.render()).toBe('item2');
        todos.removeItem(item2);
        expect(todos.items().length).toBe(2);
        expect(todos.length).toBe(2);
        expect(todos.render()).toBe('item1\nitem3');
    });
    it("properly handles repeated items when removing items", function() {
        var testFile = 'oy\noy\noy\noy\noy';
        var todos = TodoTxt.parseFile(testFile);
        expect(todos.length).toBe(5);
        todos.removeItem('oy');
        expect(todos.length).toBe(4);
        var todo = todos.items()[0];
        todos.removeItem(todo);
        expect(todos.length).toBe(3);
        todos.removeItem('oy', true);
        expect(todos.length).toBe(0);
    });
    it("adds items when asked", function() {
        var testFile = 'item1';
        var todos = TodoTxt.parseFile(testFile);
        todos.addItem('item2');
        expect(todos.length).toBe(2);
        expect(todos.items()[1].render()).toBe(isoDate() + ' item2');
        var complexItemLine = '(C) 2012-03-03 add this too!';
        var newItem = TodoTxt.parseLine(complexItemLine);
        todos.addItem(newItem);
        expect(todos.length).toBe(3);
        expect(todos.items()[2].render()).toBe(complexItemLine);
    });
    it("replaces items when asked", function() {
        var testFile = 'line1\nline2\nline3';
        var todos = TodoTxt.parseFile(testFile);
        expect(todos.length).toBe(3);
        var line2 = todos.items()[1];
        expect(line2.render()).toBe('line2');
        line2.replaceWith('xxx');
        expect(line2.render()).toBe('xxx');
        expect(todos.render()).toBe('line1\nxxx\nline3'); 
    });
    it("sorts queried items with an array of sort objects", function() {
        var first = '(A) 2014-01-02 I am first +1';
        var second = '(A) 2014-01-01 I am second';
        var third = '(B) 2014-01-03 I am third';
        var fourth = 'I am fourth';
        var testFile = fourth + '\n' + second + '\nx 2014-03-03 (A) 2014-02-02 I am ignored.\n' + first + '\n' + third;
        var todos = TodoTxt.parseFile(testFile);
        expect(todos.length).toBe(5);
        var output = todos.render({ isComplete: false }, ['priority', { field: 'createdDate', direction: TodoTxt.SORT_DESC }]);
        expect(output).toBe([first, second, third, fourth].join('\n'));
    });
    it("assigns line numbers to items", function() {
        var testFile = '(C) line 1\n(A) line 2\n(B) line 3';
        var todos = TodoTxt.parseFile(testFile);
        var items = todos.items(null, ['priority']);
        expect(items[0].lineNumber()).toBe(2);
        expect(items[1].lineNumber()).toBe(3);
        expect(items[2].lineNumber()).toBe(1);
    });
    it("sorts by line number when the comparison returns equal results", function() {
        var testFile = '(C) line 1\n(A) line 2\n(B) line 3\n(A) line 4\n' + 
            'line 5\nline 6\nline 7\nline 8';
        var todos = TodoTxt.parseFile(testFile);
        var items = todos.items(null, ['priority']);
        expect(items[0].lineNumber()).toBe(2);
        expect(items[1].lineNumber()).toBe(4);
        for (var i = 5; i <= 8; i++) {
            expect(items[i - 1].lineNumber()).toBe(i);
        }

        items = todos.items(null, [{ field: 'priority', direction: TodoTxt.SORT_DESC }]);
        for (var i = 1; i <= 4; i++) {
            expect(items[i - 1].lineNumber()).toBe(i + 4);
        }
    });
    it("can sort by line number explicitly", function() {
        var testFile = '1\n2\n3';
        var todos = TodoTxt.parseFile(testFile);
        var items = todos.items(null, ['lineNumber']);
        expect(items[0].render()).toBe('1');
        expect(items[1].render()).toBe('2');
        expect(items[2].render()).toBe('3');
        items = todos.items(null, [{ field: 'lineNumber', direction: TodoTxt.SORT_DESC }]);
        expect(items[0].render()).toBe('3');
        expect(items[1].render()).toBe('2');
        expect(items[2].render()).toBe('1');
    });

    it("throws when an invalid field is used for sorting", function() {
        var todos = TodoTxt.parseFile('blah');
        expect(function() { todos.items(null, ['asdfasdfa']); }).toThrow();
    });

    it("fetches collections when asked", function() {
        var todos = TodoTxt.parseFile("item2 @c2 +p2\nitem3 @c3 +p3\nnothing new @c1 @c2 @c3 +p1 +p2 +p3\nitem1 @c1 +p1\nx @ignore +this");
        var collections = todos.collections();
        expect(collections).toEqual({ contexts: ['@c1', '@c2', '@c3'], projects: ['+p1', '+p2', '+p3'] });
        collections = todos.collections(true);
        expect(collections).toEqual({ contexts: ['@c1', '@c2', '@c3', '@ignore'], projects: ['+p1', '+p2', '+p3', '+this'] });
    });
});

describe('TodoTxt.parseLine', function() {
	it("sets completed flag if present", function() {
		var successLine = "x This is the only valid way to do it";
		expectLines(successLine, { isComplete: true });
	});
	
	it("isn't fooled by things that aren't completed flags", function() {
		var failLines = ["xNope", "No x way", "No. x"];
		expectLinesFail(failLines, { isComplete: true});
	});
	
	it("sets completed date if present", function() {
		var successLines = ["x 2014-01-01 Looks good", "x 2014-01-01 2013-07-07 Don't be fooled!"];
		expectLines(successLines, {isComplete: true, completedDate: function(completedDate) { 
			return _.isDate(completedDate) && moment(completedDate).format('YYYYMMDD') === moment('2014-01-01').format('YYYYMMDD');
		}});
	});
	
	it("ignores quasi-completed dates", function() {
		var failLines = ["x2014-01-01 nope", "x Nope 2014-01-01", "x (A) 2014-01-01 no no no", "2014-01-01 x nopenope", "x 2014-02-30 Sorry chum, only real dates allowed"];
		expectLinesFail(failLines, { completedDate: function(completedDate) {
			return _.isDate(completedDate);
		}});
	});
	
	it("sets a priority if present", function() {
		var successLines = ["(X) I'm priority X!","(X) 2014-03-01 (Y) I'm still X!", "x (X) Completed but still OK!"];
		expectLines(successLines, { priority: "X" });
	});
	
	it("doesn't set a priority for things that look like priorities", function() {
		var failLines = ["(x) Bad news", "Bad (X) news", "(X)Bad news"];
		expectLinesFail(failLines, { priority: "X" });
	});
	
	it("sets the created date if present", function() {
		var successLines = ["2014-02-07 Perfectly cromulent date", "(A) 2014-02-07 Perfectly cromulent date"]
		expectLines(successLines, { createdDate: function(createdDate) {
			return _.isDate(createdDate) && moment(createdDate).format('YYYYMMDD') === moment('2014-02-07').format('YYYYMMDD');
		}});
	});
	
	it("ignores quasi-created dates", function() {
		var failLines = ["2014-02-30 invalid date", "x 2014-01-01 not created date", "(1) 2014-01-01 not real priority", "ignore date at the end 2014-01-01"];
		expectLinesFail(failLines, { createdDate: function(createdDate) {
			return _.isDate(createdDate);
		}});
	});
	
	it("collects valid contexts", function() {
		var successLine = "@123 (X) x 2014-03-03 @abc mike@roufa.com joe@ @ we got @love in the @house"; // a few false dates and such just for fun
		var contexts = TodoTxt.parseLine(successLine).contexts();
		expect(contexts.length).toBe(4);
		expectIdenticalArrayContents(contexts, ['@123','@abc','@love','@house']);
	});
	
	it("collects valid projects", function() {
		var successLine = "+123 (X) x 2014-03-03 +abc mike+roufa.com joe+ + we got +love in the +house"; // a few false dates and such just for fun
		var projects = TodoTxt.parseLine(successLine).projects();
		expect(projects.length).toBe(4);
		expectIdenticalArrayContents(projects, ['+123','+abc','+love','+house']);
	});
	
	it("collects valid add-ons", function() {
		var successLine = "joe:blow check one:two:three checkit :out we:love addons we:do";
		var addons = TodoTxt.parseLine(successLine).addons();
		expect(_.keys(addons).length).toBe(3);
		expect(addons['joe']).toBe('blow');
		expect(addons['one']).toBe('two:three');
		expectIdenticalArrayContents(addons['we'], ['love','do']);
	});
	
	it("produces a reasonable render", function() {
		var line = 'x 2014-03-02 (A) 2014-03-01 Finish todotxt.js! +todotxt +fun @computer @office due:2014-03-05 for:me for:everybody';
		var todo = TodoTxt.parseLine(line);
		
		expect(todo.render()).toBe(line);
	});
	
	it("can mark an incomplete item as complete", function() {
		var line = 'blah';
		var todo = TodoTxt.parseLine(line);
		expect(todo.isComplete()).toBeFalsy();
		expect(_.isDate(todo.completedDate())).toBeFalsy();
		todo.completeTask();
		expect(todo.isComplete()).toBeTruthy();
		expect(_.isDate(todo.completedDate())).toBeTruthy();
		expect(todo.render()).toBe('x ' + isoDate() + ' ' + line);
		todo.uncompleteTask();
		expect(todo.isComplete()).toBeFalsy();
		expect(_.isDate(todo.completedDate())).toBeFalsy();
		expect(todo.render()).toBe(line);
	});

    it("can add contexts, projects, and add-ons to an item, and the render makes sense", function() {
        var line = '+ptp @ptp p:tp testing test';
        var todo = TodoTxt.parseLine(line);
        todo.addContext('ctxt');
        todo.addProject('proj');
        todo.setAddOn('add', 'on');
        expect(todo.render()).toBe(line + ' @ctxt +proj add:on');
    });

    it("can remove contexts, projects, and add-ons", function() {
        var line = '(A) +ptp @tpt p:tp yay boo p:pp';
        var todo = TodoTxt.parseLine(line);
        todo.removeContext('tpt');
        todo.removeProject('ptp');
        todo.removeAddOn('p');
        expect(todo.render()).toBe('(A) yay boo');
    });

	var expectIdenticalArrayContents = function(arr1, arr2) {
		expect(_.isArray(arr1)).toBeTruthy();
		expect(_.isArray(arr2)).toBeTruthy();
		expect(arr1.length).toBe(arr2.length);
		for (var i = 0; i < arr1.length; i++) {
			expect(arr2).toContain(arr1[i]);
		}
	};
	
	var expectLines = function(lines, expected) {
		if (!_.isArray(lines)) lines = [lines];
		
		_.each(lines, function(line) {
			var todo = TodoTxt.parseLine(line);
			for (var k in expected) {
				var propVal = todo[k]();
				var expectedVal = expected[k];
				if (_.isFunction(expectedVal)) {
					expect(expectedVal(propVal)).toBeTruthy();
				}
				else {
					expect(propVal).toBe(expectedVal);
				}
			}
		});
	};
	
	var expectLinesFail = function(lines, unexpected) {
		if (!_.isArray(lines)) lines = [lines];
		
		_.each(lines, function(line) {
			var todo = TodoTxt.parseLine(line);
			for (var k in unexpected) {
				var propVal = todo[k]();
				var unexpectedVal = unexpected[k];
				if (_.isFunction(unexpectedVal)) {
					expect(unexpectedVal(propVal)).toBeFalsy();
				}
				else {
					expect(propVal).not.toBe(unexpectedVal);
				}
			} 
		});
	};
});

var isoDate = function (dt) {
    var zeropad = function (num, len) {
        var output = num.toString();
        while (output.length < len) output = '0' + output;
        return output;
    }
    if (!dt) dt = new Date();
    return dt.getFullYear() + '-' + zeropad(dt.getMonth() + 1, 2) + '-' + zeropad(dt.getDate(), 2);
};


