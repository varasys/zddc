(function() {
    'use strict';

    // Escape a string for use in a RegExp (literal match)
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Build regex pattern at parse time based on anchors
    function compilePattern(raw, anchorStart, anchorEnd) {
        var src = (anchorStart ? '^' : '') + raw + (anchorEnd ? '$' : '');
        try {
            return new RegExp(src, 'i');
        } catch (e) {
            // Invalid regex — escape and retry (always succeeds)
            var safe = (anchorStart ? '^' : '') + escapeRegex(raw) + (anchorEnd ? '$' : '');
            return new RegExp(safe, 'i');
        }
    }

    // Parse a single token string into a node
    function parseToken(token) {
        var s = token;
        var negate = false;
        var anchorStart = false;
        var anchorEnd = false;

        if (s.charAt(0) === '!') {
            negate = true;
            s = s.slice(1);
        }
        if (s.charAt(0) === '^') {
            anchorStart = true;
            s = s.slice(1);
        }
        if (s.length > 0 && s.charAt(s.length - 1) === '$') {
            anchorEnd = true;
            s = s.slice(0, -1);
        }

        if (s === '') return null;

        // bare * (possibly after stripping !) → wildcard-all or wildcard-none
        if (s === '*' && !anchorStart && !anchorEnd) {
            return negate ? null : { type: 'wildcard-all' };
        }

        var re = compilePattern(s, anchorStart, anchorEnd);
        return { type: negate ? 'no-match' : 'match', re: re };
    }

    // Parse expression string into AST array
    function parse(expression) {
        if (!expression || typeof expression !== 'string') return [];
        var trimmed = expression.trim();
        if (trimmed === '') return [];
        if (trimmed === '*') return [{ type: 'wildcard-all' }];

        var ast = [];
        var i = 0;
        var len = trimmed.length;

        while (i < len) {
            var ch = trimmed.charAt(i);

            if (ch === '(') {
                var depth = 1;
                var j = i + 1;
                while (j < len && depth > 0) {
                    if (trimmed.charAt(j) === '(') depth++;
                    else if (trimmed.charAt(j) === ')') depth--;
                    j++;
                }
                var innerAst = parse(trimmed.slice(i + 1, j - 1));
                if (innerAst.length === 1) {
                    ast.push(innerAst[0]);
                } else if (innerAst.length > 1) {
                    for (var k = 0; k < innerAst.length; k++) ast.push(innerAst[k]);
                }
                i = j;
            } else if (ch === '|') {
                ast.push({ type: 'pipe' });
                i++;
            } else if (ch === ' ') {
                i++;
            } else {
                var j = i;
                while (j < len) {
                    var c = trimmed.charAt(j);
                    if (c === ' ' || c === '(' || c === '|' || c === ')') break;
                    j++;
                }
                var token = trimmed.slice(i, j);
                if (token.length > 0) {
                    var node = parseToken(token);
                    if (node !== null) ast.push(node);
                }
                i = j;
            }
        }

        // Group pipes into OR nodes
        var hasPipe = false;
        var branches = [[]];
        for (var l = 0; l < ast.length; l++) {
            if (ast[l].type === 'pipe') {
                hasPipe = true;
                branches.push([]);
            } else {
                branches[branches.length - 1].push(ast[l]);
            }
        }
        branches = branches.filter(function(b) { return b.length > 0; });

        if (!hasPipe) {
            return ast.filter(function(n) { return n.type !== 'pipe'; });
        }

        var orNodes = branches.map(function(branch) {
            if (branch.length === 1) return branch[0];
            return { type: 'and', nodes: branch };
        });
        return [{ type: 'or', nodes: orNodes }];
    }

    // Check if a single node matches the value
    function nodeMatches(node, value) {
        switch (node.type) {
            case 'wildcard-all': return true;
            case 'match':    return node.re.test(value);
            case 'no-match': return !node.re.test(value);
            case 'or':
                for (var i = 0; i < node.nodes.length; i++) {
                    if (nodeMatches(node.nodes[i], value)) return true;
                }
                return false;
            case 'and':
                for (var i = 0; i < node.nodes.length; i++) {
                    if (!nodeMatches(node.nodes[i], value)) return false;
                }
                return true;
            default: return false;
        }
    }

    // Evaluate AST against value
    function matches(value, ast) {
        if (!ast || ast.length === 0) return true;
        var v = String(value); // no forced lowercase — regex has 'i' flag
        for (var i = 0; i < ast.length; i++) {
            if (!nodeMatches(ast[i], v)) return false;
        }
        return true;
    }

    window.ZDDCFilter = { parse: parse, matches: matches };
})();
