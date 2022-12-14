/**
 * Chai plugin for comparing strings using the JsDiff library.
 *
 * It gives descriptive error messages for differences in long strings.
 */
"use strict";

// Boilerplate to support AMD (RequireJS), CommonJD (Node) and global variables.
// http://ifandelse.com/its-not-hard-making-your-library-support-amd-and-commonjs/
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(["diff"], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory(require("diff"));
    } else {
        root.chaiDiff = factory(root.diff);
    }
}(this, function (diff) {

    diff = diff || window.JsDiff;

    var chaiDiff = function (chai) {

        var Assertion = chai.Assertion;

        /**
         * Diff the actual value against an expected value line by line and if different,
         * show a full difference with lines added and lines removed. If non-string values
         * are being compared, they are JSON stringified first.
         *
         * Takes an optional options object with flags for:
         *   - showSpace (false) whether to replace whitespace with unicode dots and arrows
         *   - relaxedSpaces (false) whether to normalize strings before comparing them.
         *         This removes empty lines, spaces from the beginning and end of each line
         *         and compresses sequences of whitespace to a single space.
         */
        Assertion.addMethod('differentFrom', function (expected, options) {
            var actualStr = chaiDiff.stringify(this._obj);
            var expectedStr = chaiDiff.stringify(expected);
            var result = chaiDiff.diffLines(expectedStr, actualStr, options);
            this.assert(
                result.diffCount != 0,
                'Strings were unexpectedly identical:\n' + actualStr,
                ['Got ', result.diffCount, ' unexpected difference', result.diffCount == 1 ? '' : 's', ':\n' + result.diffStr].join("")
            );
        });

    };

    chaiDiff.stringify = function (v) {
        if (typeof(v) === 'string' || v == null) {
            return v;
        }
        return JSON.stringify(v, null, 2);
    };

    /** Normalize whitespace in strings for relaxed comparison. */
    chaiDiff.normalize = function (s) {
        return s
            .replace(/[ \t???]+/g, ' ')     // Replace all horizontal whitespace with single space
            .replace(/[\f\r\v]/g, '\n')  // Replace all vertical whitespace with newline
            .replace(/\n[ ???]/g, '\n')     // Remove whitespace at beginning of line
            .replace(/[ ]\n/g, '\n')     // Remove whitespace at end of line
            .replace(/^[ ???\n]*/g, '')     // Remove whitespace at beginning of string
            .replace(/[ \n]*$/g, '')     // Remove whitespace at end of string
            .replace(/[\n\f\r\v]+/g, '\n');  // Remove empty lines (may have contained spaces before)
    };

    var CTX = '  ',
        ADD = '+ ',
        SUB = '- ';

    chaiDiff.diffLines = function (expected, actual, options) {
        if (actual == null && expected == null) return {
            diffCount: 0,
            diffStr: ''
        };
        if (actual == null && expected != null) return {
            diffCount: 1,
            diffStr: 'actual is null or undefined but expected is not'
        };
        if (actual != null && expected == null) return {
            diffCount: 1,
            diffStr: 'expected is null or undefined but actual is not'
        };

        options = options || {};
        var showSpace = !!options.showSpace;
        var relaxedSpace = !!options.relaxedSpace;
        var context = parseInt(options.context) || 10;

        // Stringify and normalize objects
        if (relaxedSpace) {
            actual = chaiDiff.normalize(actual);
            expected = chaiDiff.normalize(expected);
        }

        var diffParts = diff.diffLines(expected, actual);
        var diffStr = [];
        var diffCount = 0;
        var lastAction;
        diffParts.forEach(function (part, idx) {
            var action;
            var value = part.value;
            var isFirst = idx == 0;
            var isLast = idx == diffParts.length - 1;
            if (part.added) {
                action = ADD;
                if (lastAction !== SUB) {
                    diffCount++;
                }
            } else if (part.removed) {
                action = SUB;
                if (lastAction !== ADD) {
                    diffCount++;
                }
            } else {
                action = CTX;
                if (value.charAt(value.length - 1) == '\n') {
                    value = value.substr(0, value.length - 1);
                    var choppedNewline = true;
                }
                var lines = value.split('\n');
                var pickedLines = [];
                var gap = lines.length > (isFirst ? 0 : context) + (isLast ? 0 : context);
                if (!isFirst) {
                    pickedLines = pickedLines.concat(lines.slice(0, context));
                }
                if (gap) {
                    pickedLines.push('???');
                }
                if (!isLast) {
                    pickedLines = pickedLines.concat(lines.slice(Math.max(lines.length - context, pickedLines.length)));
                }
                value = pickedLines.join('\n');
                if (choppedNewline) {
                    value += '\n';
                }
            }
            if (showSpace) {
                value = value.replace(/ /g, '??');
                value = value.replace(/\t/g, '  ??? ');
                value = value.replace(/\n/g, '???\n');
                value = value.replace(/^??????\n/g, '???\n');  // Don't show newline after ellipsis that we inserted
            }

            // Add +, - or space at the beginning of each line in value,
            // and make sure it ends with \n to not run into the next one.
            // You will need to enable showSpace to see this difference!
            value = action + value.replace(/\n(.)/g, '\n' + action + '$1');
            if (value.charAt(value.length - 1) !== '\n') {
                value += '\n';
            }
            diffStr.push(value);
            lastAction = action;
        });

        // Remove any trailing line-feeds which we may have overzealously added above
        diffStr = diffStr.join('');
        while (diffStr.charAt(diffStr.length - 1) == '\n') {
            diffStr = diffStr.substr(0, diffStr.length - 1);
        }

        return {
            diffCount: diffCount,
            diffStr: diffStr
        }
    };

    return chaiDiff

}));
