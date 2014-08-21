describe('The todo.txt parseFile function', function() {
	it("generates an array from a blob of text", function() {
		var testFile = 'Task1\nTask2';
		var output = TodoTxt.parseFile(testFile);
		expect(output.length).toBe(2);
	});
	it("ignores blank lines", function() {
		var testFile = '\nTask1\n   \n\t\nTask2\n \n';
		var output = TodoTxt.parseFile(testFile);
		expect(output.length).toBe(2);
	});
	it("renders todos as text", function() {
		var testFile = 'Task1\nTask2';
		expect(TodoTxt.parseFile(testFile).render()).toBe(testFile);
	});
});

describe('The todo.txt parseLine function', function() {
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
		var contexts = TodoTxt.parseLine(successLine).contexts;
		expect(contexts.length).toBe(4);
		expectIdenticalArrayContents(contexts, ['@123','@abc','@love','@house']);
	});
	
	it("collects valid projects", function() {
		var successLine = "+123 (X) x 2014-03-03 +abc mike+roufa.com joe+ + we got +love in the +house"; // a few false dates and such just for fun
		var projects = TodoTxt.parseLine(successLine).projects;
		expect(projects.length).toBe(4);
		expectIdenticalArrayContents(projects, ['+123','+abc','+love','+house']);
	});
	
	it("collects valid add-ons", function() {
		var successLine = "joe:blow check one:two:three checkit :out we:love addons we:do";
		var addons = TodoTxt.parseLine(successLine).addons;
		expect(_.keys(addons).length).toBe(3);
		expect(addons['joe']).toBe('blow');
		expect(addons['one']).toBe('two:three');
		expectIdenticalArrayContents(addons['we'], ['love','do']);
	});
	
	it("produces a reasonable toString", function() {
		// Sure would be nice if it could maintain order... oh well.
		var todo = TodoTxt.parseLine();
		todo.createdDate = new Date('2014/03/01');
		todo.priority = 'A';
		todo.complete = true;
		todo.completedDate = new Date('2014/03/02');
		todo.contexts = ['@computer','@office'];
		todo.projects = ['+todotxt','+fun'];
		todo.addons = { due: '2014-03-05', 'for': ['me','everybody'] };
		todo.text = 'Finish todotxt.js!';
		
		expect(todo.render()).toBe('x 2014-03-02 (A) 2014-03-01 Finish todotxt.js! +todotxt +fun @computer @office due:2014-03-05 for:me for:everybody');
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
				if (_.isFunction(expected[k])) {
					expect(expected[k](todo[k])).toBeTruthy();
				}
				else {
					expect(todo[k]).toBe(expected[k]);
				}
			}
		});
	};
	
	var expectLinesFail = function(lines, unexpected) {
		if (!_.isArray(lines)) lines = [lines];
		
		_.each(lines, function(line) {
			var todo = TodoTxt.parseLine(line);
			for (var k in unexpected) {
				if (_.isFunction(unexpected[k])) {
					expect(unexpected[k](todo[k])).toBeFalsy();
				}
				else {
					expect(todo[k]).not.toBe(unexpected[k]);
				}
			} 
		});
	};
	
});