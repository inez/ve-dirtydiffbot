// while true; do perl -e 'alarm shift @ARGV; exec @ARGV' 60 casperjs test.js; done

/*global mw, ve, $ */

var casper, articleName, url;

function msg(text) {
	casper.echo('[ve-dirtydiffbot] ' + text);
}

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

articleName = casper.cli.args.length === 0 ? 'Special:Random' : casper.cli.args[0];
url = 'http://en.wikipedia.org/wiki/' + encodeURIComponent(articleName);
msg('Loading page "' + articleName + '"...');

casper.userAgent('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1468.0 Safari/537.36');

casper.start(url, function () {
	// PhantomJS does not have Function.prototype.bind,
	// so inject this Mozilla shim into the page.
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
	articleName = this.evaluate(function () {
		return mw.config.get('wgPageName');
	});
	msg('Loaded "' + articleName + '"');
	msg('VisualEditor initializing...');
	this.evaluate(function () {
		mw.loader.using('ext.visualEditor.viewPageTarget', function () {
			$('#ca-edit').find('a').click();
		});
	});
	this.waitFor(function () {
		return this.evaluate(function () {
			return ve.init.mw.targets[0].active === true;
		});
	});
});

casper.then(function () {
	msg('VisualEditor initialized');
	msg('VisualEditor generating diff...');
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
		msg('VisualEditor got dirty diff');
		msg('Capturing diff and writing to disk for analysis');
		clipRect = this.evaluate(function () {
			var $saveDialog = $('.ve-init-mw-viewPageTarget-saveDialog');
			$saveDialog.css('max-height', '10000px');
			return {
				top: $saveDialog.offset().top,
				left: $saveDialog.offset().left,
				width: $saveDialog.outerWidth(),
				height: $saveDialog.outerHeight()
			};
		});
		this.capture('diff/' + articleName.replace(/ /g, '_').replace(/[^a-zA-Z0-9_\-]/g, '-') + '.png', clipRect);
	} else {
		msg('VisualEditor got clean diff');
	}
});

casper.run(function () {
	msg('Closing "' + articleName + '"...');
	this.exit();
});
