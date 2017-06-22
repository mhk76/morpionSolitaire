'use strict';

const __boardSize = 30;
const __defaultBoard = parseBoard(
	  '   oooo   |'
	+ '   o  o   |'
	+ '   o  o   |'
	+ 'oooo  oooo|'
	+ 'o        o|'
	+ 'o        o|'
	+ 'oooo  oooo|'
	+ '   o  o   |'
	+ '   o  o   |'
	+ '   oooo   ');
const __lineMax = 4;
const __line = [
	 { x: -1, y: -1, reverse: 7 },
	 { x: 0, y: -1, reverse: 6 },
	 { x: 1, y: -1, reverse: 5 },
	 { x: -1, y: 0, reverse: 4 },
	 { x: 1, y: 0, reverse: 3 },
	 { x: -1, y: 1, reverse: 2 },
	 { x: 0, y: 1, reverse: 1 },
	 { x: 1, y: 1, reverse: 0 }
];
const __moveChar = '0123456789abcdefghijklmnopqrstuvwxyz#-!%'.split('');
const __highscoreLimit = 20;

var _clone = require('clone');
var _serverManager;
var _highscores = [{
		name: 'Mikko',
		date: new Date(2011, 10, 9),
		moves: [],
		lineCount: 158,
		string: 'ddbf2fefe3gefe5efef1egef7dibg8idgb8hfhf1hghf7gfed8fhfh3ghfh5bibi1ibib3gdib6fgde8fddd5gcgb7jfjf0igig0'
		      + 'dfdf2gigi0dgdd7cgbg5ajaj2fjfj0jcjc6kdkd7ifkd6icib7ffic6fcfb7ggdd8cfcf2aibf5fifi09j9j2cici1jdec5lflf0'
		      + 'cjai5bkbk2bjff7djdj3akak2flfl0gjgj1jgjg3dkff5clcl2dldl1bljd6ckbl2bmbm1cmcm1dndn0emem0dmak5elfl3fmfm3'
		      + 'enen1iiii3ijij1ikik3jien0gldj5dodo2cncn2hlgi6jjgi2fnfn1gmbi8kijc7jkjk1lhgj2lglg6ldld3leld7mfmf0nfnf3'
		      + 'gngn1ilcn5eoeo2mgmg6jljl3kmkm0ngng3epdn2fqfq0hmhj2foep2hnhn1lieb8mjmj0mimi3jmjm0imjm3jnjn0inin1knkn3'
		      + 'jojo0gojk7hoho3gpfq2fpfp2frfr1njnj0mhmf7kjil2nhnh3ljlj3kkjl2mkmk0llll0lkmk3klkl1ninf7ojoj0pjpj3oipj0'
		      + 'mlml0nlnl3lmlm0nkoj6iooi6hpjm2ipip3gqgq2jpjp0jqjq0iqiq0grgr1hrhr0hqhr1irir0jrjr3jsjs1kokn6lolo3kpkp1'
		      + 'lnln6mmlh7nmnm3nnnn1mnmn1onon3lplp1okpj6mpmp3nqnq0hshs2pkin7qkqk3olpk6omoi7mofq5plqk6dpdp1'
	}];

exports.init = function(serverManager)
{
	_serverManager = serverManager;
	_serverManager.setListener(listener);	
	_serverManager.initCache('highscores', _highscores);

	_highscores = _serverManager.cache('highscores');

	for (var i = 0; i < _highscores.length; i++)
	{
		_highscores[i].moves = parseMoves(_highscores[i].string);
	}

	function parseMoves(str)
	{
		var moves = [];

		for (var i = 0; i < str.length; i += 5)
		{
			moves.push({
				dot: 1,
				x: __moveChar.indexOf(str.charAt(i)),
				y: __moveChar.indexOf(str.charAt(i + 1))
			});
			moves.push({
				x: __moveChar.indexOf(str.charAt(i + 2)),
				y: __moveChar.indexOf(str.charAt(i + 3)),
				dir: __moveChar.indexOf(str.charAt(i + 4))
			});
		}

		return moves;
	} // function parseMoves()

}; // exports.init()

function listener(request)
{
	switch (request.action)
	{
		case 'submit':
		{
			onSubmit(request);
			return;
		}
		default:
		{
			request.response(
				{
					highscores: getHighscores()
				},
				'ok'
			);
			return;
		}
	} // switch (request.action)
} // function listerner()

function onSubmit(request)
{
	if (checkSubmit(request.parameters))
	{
		request.response('invalid-data', 'error');
		return;
	}

	var boardString = buildMovesString(request.parameters.moves);
	var lineCount = parseInt(request.parameters.moves.length / 2);
	var index = _highscores.length;
	var message;
	
	for (var i = 0; i < _highscores.length; i++)
	{
		if (boardString == _highscores[i].string)
		{
			index = -1;
			break;
		}
		if (lineCount > _highscores[i].lineCount)
		{
			index = i;
			break;
		}
	}

	if (index === -1)
	{
		message = 'same-result';
	}
	else if (index < __highscoreLimit)
	{
		var date = new Date();

		_highscores.splice(
				index,
				0,
				{
					name: request.parameters.name || 'unnamed',
					date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
					moves: request.parameters.moves,
					lineCount: lineCount,
					string: boardString
				}
			);
		_highscores = _highscores.slice(0, __highscoreLimit);

		_serverManager.cache('highscores', _highscores);

		message = 'new-highscore';
	}

	request.response(
		{
			highscores: getHighscores(),
			message: message
		},
		'ok'
	);
} // function onSubmit()

function checkSubmit(parameters)
{
	if (!Array.isArray(parameters.moves))
	{
		return true;
	}
	if (parameters.moves.length % 2 === 1)
	{
		return true;
	}
	if (!parameters.moves[0].dot || parameters.moves[parameters.moves.length - 1].dot)
	{
		return true;
	}

	var board = {
		lineCount: 0,
		grid: _clone(__defaultBoard.grid)
	};
	var dot = true;

	for (var i = 0; i < parameters.moves.length; i++)
	{
		var move = parameters.moves[i];

		if (dot)
		{
			if (checkDot(board, move))
			{
				return true;
			}
		}
		else
		{
			if (checkLine(board, move))
			{
				return true;
			}

			++board.lineCount;
		}

		dot = !dot;
	} // for (parameters.moves)

	return false;

	function checkDot(board, move)
	{
		if (!move.dot)
		{
			return true;
		}

		var x = parseInt(move.x);
		var y = parseInt(move.y);

		if (
			isNaN(x) || x < 0 || x >= __boardSize
			|| isNaN(y) || y < 0 || y >= __boardSize
		)
		{
			return true;
		}
		if (board.grid[y][x] != null)
		{
			return true;
		}

		board.grid[y][x] = [0, 0, 0, 0, 0, 0, 0, 0];

		return false;
	} // function checkDot()

	function checkLine(board, move)
	{
		if (move.dot)
		{
			return true;
		}

		var x = parseInt(move.x);
		var y = parseInt(move.y);
		var direction = parseInt(move.dir);

		if (
			isNaN(x) || x < 0 || x >= __boardSize
			|| isNaN(y) || y < 0 || y >= __boardSize
			|| isNaN(direction) || direction < 0 || direction > 7
		)
		{
			return true;
		}

		var reverse = __line[direction].reverse;
		var dx = __line[direction].x;
		var dy = __line[direction].y;
		var ix = x;
		var iy = y;

		for (var i = 0; i <= __lineMax; i++)
		{
			if (ix < 0 || ix >= __boardSize || iy < 0 || iy >= __boardSize)
			{
				return true;
			}
			if (board.grid[iy][ix] == null)
			{
				return true;
			}
			if (i !== __lineMax && board.grid[iy][ix][direction])
			{
				return true;
			}
			if (i !== 0 && board.grid[iy][ix][reverse])
			{
				return true;
			}

			if (i < __lineMax)
			{
				board.grid[iy][ix][direction] = 1;
			}
			if (i > 0)
			{
				board.grid[iy][ix][reverse] = 1;
			}

			ix += dx;
			iy += dy;
		} // for (_lineMax)

		return false;
	} // function checkLine()

} // function checkSubmit()

function parseBoard(input)
{
	var lines = input.split('|');
	var output = {
		grid: new Array(__boardSize),
		lineCount: 0
	};
	var y = __boardSize / 2 - parseInt(lines.length / 2 + 0.5);

	for (var i = 0; i < __boardSize; i++)
	{
		output.grid[i] = new Array(__boardSize);
	}

	for (var i = 0; i < lines.length; i++)
	{
		var chars = lines[i].split('');
		var x = __boardSize / 2 - parseInt(chars.length / 2 + 0.5);

		for (var j = 0; j < chars.length; j++)
		{
			if (chars[j] != ' ')
			{
				output.grid[y][x] = [0, 0, 0, 0, 0, 0, 0, 0];
			}
			++x;
		}
		++y;
	}

	return output;
} // function parseBoard()

function buildMovesString(moves)
{
	var str = [];

	for (var i = 0; i < moves.length; i++)
	{
		str.push(__moveChar[parseInt(moves[i].x)]);
		str.push(__moveChar[parseInt(moves[i].y)]);

		if (moves[i].dir != null)
		{
			str.push(__moveChar[parseInt(moves[i].dir)]);
		}
	}

	return str.join('');
} // function buildMovesString()

function getHighscores()
{
 	return _highscores
		.map(function(item)
		{
			return {
				name: item.name,
				date: item.date,
				lineCount: item.lineCount,
				moves: item.moves
			};
		});
}