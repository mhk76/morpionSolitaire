var _serverManager;

const __defaultBoard =
	  '   oooo   |'
	+ '   o  o   |'
	+ '   o  o   |'
	+ 'oooo  oooo|'
	+ 'o        o|'
	+ 'o        o|'
	+ 'oooo  oooo|'
	+ '   o  o   |'
	+ '   o  o   |'
	+ '   oooo   ';
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
const __boardSize = 40;
const __lineLength = 4;
const __moveChar = '0123456789abcdefghijklmnopqrstuvwxyz#-!%'.split('');

exports.init = function(serverManager)
{
	var defaultHighScore = {
		name: 'Mikko',
		date: new Date(2011, 10, 9),
		moves: [],
		id: 'IIGK2KJKJ4LJKJ6JKJK1JLJK9INGLANILGAMKMK1MLMK9LKJIAKMKM4LMKM6GNGN1NGNG4LING8KLIJAKIII6LHLG9OKOK0NLNL0'
		  + 'IKIK2LNLN0ILII9HLGL6FOFO2KOKO0OHOH8PIPI9NKPI8NHNG9KKNH8KHKG9LLIIAHKHK2FNGK6KNKN0EOEO2HNHN1OIJH6QKQK0'
		  + 'HOFN6GPGP2GOKK9IOIO4FPFP2KQKQ0LOLO1OLOL4IPKK6HQHQ2IQIQ1GQOI8HPGQ2GRGR1HRHR1ISIS0JRJR0IRFP6JQKQ4KRKR4'
		  + 'JSJS1NNNN4NONO1NPNP4ONJS0LQIO6ITIT2HSHS2MQLN8OOLN2KSKS1LRGNAPNOH9OPOP1QMLO2QLQL8QIQI4QJQI9RKRK0SKSK4'
		  + 'LSLS1NQHS6JTJT2RLRL8OQOQ4PRPR0SLSL4JUIS2KVKV0MRMO2KTJU2MSMS1QNJGARORO0RNRN4OROR0NROR4OSOS0NSNS1PSPS4'
		  + 'OTOT0LTOP9MTMT4LUKV2KUKU2KWKW1SOSO0RMRK9PONQ2SMSM4QOQO4PPOQ2RPRP0QQQQ0QPRP4PQPQ1SNSK9TOTO0UOUO4TNUO0'
		  + 'RQRQ0SQSQ4QRQR0SPTO8NTTN8MUOR2NUNU4LVLV2OUOU0OVOV0NVNV0LWLW1MWMW0MVMW1NWNW0OWOW4OXOX1PTPS8QTQT4PUPU1'
		  + 'QSQS8RRQM9SRSR4SSSS1RSRS1TSTS4QUQU1TPUO8RURU4SVSV0MXMX2UPNS9VPVP4TQUP8TRTN9RTKV6UQVP8IUIU1'
	};

	defaultHighScore.moves = getMoves(defaultHighScore.id.toLowerCase()) 

	_serverManager = serverManager;
	_serverManager.webSocket.setDefaultListener(Listener);
	_serverManager.initCache('users', {});
	_serverManager.initCache('highScore', [defaultHighScore]);

	function getMoves(str)
	{
		var moves = [];

		for (var i = 0; i < str.length; i += 5)
		{
			moves.push({
				dot: true,
				x: __moveChar.indexOf(str.charAt(i)) + 10,
				y: __moveChar.indexOf(str.charAt(i + 1)) + 10
			});

			var direction = __moveChar.indexOf(str.charAt(i + 4));

			if (direction > 7)
			{
				--direction;
			}
			if (direction > 3)
			{
				--direction;
			}

			moves.push({
				dot: false,
				x: __moveChar.indexOf(str.charAt(i + 2)) + 10,
				y: __moveChar.indexOf(str.charAt(i + 3)) + 10,
				direction: direction
			});
		}

		return moves;
	}
};

function Listener(request)
{
	var userData = _serverManager.cache('users')[request.userId];
	var response = {};

	if (!userData)
	{
		userData = {
			board: GetBoard(__defaultBoard),
			ordinal: 0,
			placeDot: true
		};
	}

	switch (request.action)
	{
		case 'new':
		{
			userData = {
				board: GetBoard(__defaultBoard),
				ordinal: 0,
				placeDot: true
			};
			break;
		}
		case 'dot':
		{
			if (!userData.placeDot || !request.data)
			{
				return null;				
			}

			var x = parseInt(request.data.x);
			var y = parseInt(request.data.y);

			if (x < 0 || x >= __boardSize || y < 0 || y >= __boardSize)
			{
				return null;
			}
			if (userData.board.grid[y][x] != null)
			{
				return null;
			}

			userData.board.moves.push({ dot: true, x: x, y: y });
			userData.board.grid[y][x] = userData.board.list.length; 
			userData.board.list.push({
				x: x,
				y: y,
				ordinal: ++userData.ordinal,
				line: [false, false, false, false, false, false, false, false]
			})
			userData.placeDot = false;

			break;
		}
		case 'line':
		{
			if (userData.placeDot || !request.data)
			{
				return null;				
			}

			var x = parseInt(request.data.x);
			var y = parseInt(request.data.y);
			var direction = parseInt(request.data.direction);

			if (x < 0 || x >= __boardSize || y < 0 || y >= __boardSize || direction < 0 || direction > 7)
			{
				return null;
			}

			var ix = x;
			var iy = y;

			for (var i = 0; i <= __lineLength; i++)
			{
				if (check(ix, iy, direction, __line[direction].reverse, i === 0, i === __lineLength))
				{
					return null;
				}

				ix += __line[direction].x;
				iy += __line[direction].y;
			}

			userData.board.moves.push({ dot: false, x: x, y: y, direction: direction });

			ix = x;
			iy = y;

			for (var i = 0; i <= __lineLength; i++)
			{
				if (i < __lineLength)
				{
					userData.board.grid[iy][ix].line[direction] = true;
				}
				if (i > 0)
				{
					userData.board.grid[iy][ix].line[__line[direction].reverse] = true;
				}

				ix += __line[direction].x;
				iy += __line[direction].y;
			}

			break;

			function check(x, y, direction, reverse, first, last)
			{
				if (userData.board.grid[y][x] == null)
				{
					return true;
				}
				if (!last && userData.board.grid[y][x].line[direction])
				{
					return true;
				}
				if (!first && userData.board.grid[y][x].line[reverse])
				{
					return true;
				}
				return false;
			}
		}
		case 'done':
		{
			_serverManager.cache('highScore')
			break;
		}
		default:
		{
			response = {
				list: userData.board.list,
				ordinal: userData.ordinal,
				placeDot: userData.placeDot,
				highScore: []				
			};

			var highScore = _serverManager.cache('highScore');

			break;
		}
	}

	var newData = {};

	newData[request.userId] = userData;

	_serverManager.cache('users', newData);

	request.response(response, 'ok');
}

function GetBoard(input)
{
	var lines = input.split('|');
	var output = {
		grid: new Array(__boardSize),
		list: [],
		moves: [],
		moveString: ''
	};
	var y = parseInt(lines.length / 2 + 0.5) - lines.length + __boardSize / 2;

	for (var i = 0; i < lines.length; i++)
	{
		var chars = lines[i].split('');
		var x = parseInt(chars.length / 2 + 0.5) - chars.length + __boardSize / 2;

		output.grid[y] = new Array(__boardSize);

		for (var j = 0; j < chars.length; j++)
		{
			if (chars[j] != ' ')
			{
				output.grid[y][x] = output.list.length;  
				output.list.push({
					x: x,
					y: y,
					line: [false, false, false, false, false, false, false, false]
				});
			}
			++x;
		}

		++y;
	}

	return output;
};