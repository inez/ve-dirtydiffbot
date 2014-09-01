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
	logLevel: 'debug',
	onPageInitialized: function () {
		casper.evaluate(function () {
			/* Placeholder to execute code early on when the DOM is ready */
		});
	}
});

articleName = casper.cli.args.length === 0 ? 'Special:Random' : casper.cli.args[0];
url = 'http://en.wikipedia.org/wiki/' + encodeURIComponent(articleName);
msg('Loading page "' + articleName + '"...');

casper.userAgent(phantom.defaultPageSettings.userAgent + ' CasperJS/' + phantom.casperVersion + ' ve-dirtydiffbot');

casper.start(url, function () {

	articleName = this.evaluate(function () {
		return mw.config.get('wgPageName');
	});
	msg('Loaded "' + articleName + '"');
	msg('VisualEditor initializing...');

	this.evaluate(function () {
		mw.loader.using(['ext.visualEditor.viewPageTarget.init', 'jquery.cookie'], function () {
			if (mw.libs.ve.isAvailable && !$('html').hasClass('ve-available')) {
				$('html')
					.removeClass('ve-not-available')
					.addClass('ve-available');
				mw.libs.ve.setupSkin();
			}

			// Override welcome dialog
			$.cookie('ve-beta-welcome-dialog', '1', { path: '/' });

			mw.libs.ve.onEditTabClick(new $.Event('click'));
		});
	});
	this.waitFor(function () {
		return this.evaluate(function () {
			return ve.init.target && ve.init.target.active === true;
		});
	});
});

casper.then(function () {
	msg('VisualEditor initialized');
	msg('VisualEditor generating diff...');
	this.evaluate(function () {
		ve.init.target.edited = true;
		ve.init.target.toolbarSaveButton.setDisabled(false);
		ve.init.target.onToolbarSaveButtonClick();
		setTimeout(function () {
			ve.init.target.onSaveDialogReview();
		}, 2000);
	});
	this.wait(500, function () {
		this.waitFor(function () {
			return this.evaluate(function () {
				return ve.init.target.saveDialog.isPending() === false;
			});
		});
	});
});

casper.then(function () {
	var clipRect, diffLength;

	diffLength = this.evaluate(function () {
		var saveDialog = ve.init.target.saveDialog;
		return saveDialog.$body.find('.diff tr').length;
	});

	if (diffLength > 1) {
		msg('VisualEditor got dirty diff');
		msg('Capturing diff and writing to disk for analysis');
		clipRect = this.evaluate(function () {
			var saveDialog = ve.init.target.saveDialog,
				$frame = $('.oo-ui-window-frame').css('height', '');

			return {
				top: $frame.offset().top,
				left: $frame.offset().left,
				width: $frame.outerWidth(),
				// Can't use outerHeight of frame because it is too fluid,
				// it expanded to the max 10000px available instantly
				height: saveDialog.$reviewViewer.outerHeight() + 150
			};
		});
		this.capture(articleName.replace(/ /g, '_').replace(/[^a-zA-Z0-9_\-]/g, '-') + '.png', clipRect);
	} else {
		msg('VisualEditor got clean diff');
	}
});

casper.run(function () {
	msg('Closing "' + articleName + '"...');
	this.exit();
});
