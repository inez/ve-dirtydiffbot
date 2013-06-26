// while true; do perl -e 'alarm shift @ARGV; exec @ARGV' 60 casperjs test.js; done

/*global mw, ve, $ */

var casper, articleName, url;

casper = require('casper').create({
	viewportSize: {
		width: 1280,
		height: 1024
	},
	stepTimeout: 45000,
	timeout: 45000,
	waitTimeout: 45000,
	onTimeout: function () {
		casper.echo('timeout!');
		casper.exit();
	},
	onError: function () {
		casper.echo('error!');
		casper.exit();
	},
	verbose: true,
	logLevel: 'debug'
});

if (casper.cli.args.length === 0) {
	articleName = null;
	url = 'http://en.wikipedia.org/wiki/Special:Random';
	casper.echo('### GOING TO RANDOM ARTICLE ###');
} else {
	articleName = casper.cli.args[0];
	url = 'http://en.wikipedia.org/wiki/' + articleName;
	casper.echo('### GOING TO ARTICLE ' + articleName + ' ###');
}

casper.userAgent('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1468.0 Safari/537.36');

casper.start('http://en.wikipedia.org/w/index.php?title=Special:UserLogin', function () {
	var userName = this.evaluate(function () {
		return mw.getConfig('wgUserName');
	});
	if (!userName) {
		this.echo('Need to login.');
		this.fill('form[name="userlogin"]', {
			wpName: 'InezTest',
			wpPassword: '<password>'
		}, true);
	}
});
casper.thenOpen(url, function () {
	// PhantomJS does not have Function.prototype.bind to inject this Mozilla shim into the page
	this.evaluate(function () {
		if (!Function.prototype.bind) {
			Function.prototype.bind = function (oThis) {
				if (typeof this !== 'function') {
					// closest thing possible to the ECMAScript 5 internal IsCallable function
					throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
				}

				var aArgs = Array.prototype.slice.call(arguments, 1),
						fToBind = this,
						FNOP = function () {},
						fBound = function () {
							return fToBind.apply(
								this instanceof FNOP && oThis ?
									this :
									oThis,
								aArgs.concat(Array.prototype.slice.call(arguments))
							);
						};

				FNOP.prototype = this.prototype;
				fBound.prototype = new FNOP();

				return fBound;
			};
		}
	});
	if (articleName === null) {
		articleName = this.evaluate(function () {
			return mw.getConfig('wgPageName');
		});
	}
	// Re-initialize main target cause the original initialization failed (cause there was no Function.prototype.bind).
	this.evaluate(function () {
		ve.init.mw.targets[0] = new ve.init.mw.ViewPageTarget();
		// Click edit
		$('#ca-edit').find('a').click();
	});
	this.waitFor(function () {
		return this.evaluate(function () {
			return ve.init.mw.targets[0].active === true;
		});
	});
});

casper.then(function () {
	this.evaluate(function () {
		ve.init.mw.targets[0].edited = true;
		ve.init.mw.targets[0].toolbarSaveButton.setDisabled(false);
		ve.init.mw.targets[0].onToolbarSaveButtonClick();
		ve.init.mw.targets[0].swapSaveDialog('review');
	});
	this.wait(500, function () {
		this.waitFor(function () {
			return this.evaluate(function () {
				return $('.ve-init-mw-viewPageTarget-saveDialog-working').css('display') === 'none';
			});
		});
	});
});

casper.then(function () {
	var clipRect, diffLength;

	diffLength = this.evaluate(function () {
		return $('.diff tr').length;
	});

	if (diffLength > 1) {
		this.echo('DIFF DIFF DIFF');
		clipRect = this.evaluate(function () {
			$('.ve-init-mw-viewPageTarget-saveDialog').css('max-height', '10000px');
			return {
				top: $('.ve-init-mw-viewPageTarget-saveDialog').offset().top,
				left: $('.ve-init-mw-viewPageTarget-saveDialog').offset().left,
				width: $('.ve-init-mw-viewPageTarget-saveDialog').outerWidth(),
				height: $('.ve-init-mw-viewPageTarget-saveDialog').outerHeight()
			};
		});
		this.capture('diff/' + articleName.replace(/\//g, '--SLASH--') + '.png', clipRect);
	}
});

casper.run(function () {
	this.echo('...');
	this.echo('### DONE WITH ARTICLE ' + articleName + ' ###');
	this.exit();
});
