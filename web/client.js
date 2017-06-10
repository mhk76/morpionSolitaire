'use strict';

angular.module('MorpionSolitaire', ['Tools'])
.controller('GameController', function($scope, $q, $timeout, dictionary, dialog, serverComm)
{
	const __boardSize = 30;
	const __gridSize = 20;
	const __gridOffset = 10;
	const __gridLine = __gridSize / 2;
	const __canvasSize = __boardSize * __gridSize + 1;
	const __lineLength = 4;
	const __dirUpLeft = 0;
	const __dirUp = 1;
	const __dirUpRight = 2;
	const __dirLeft = 3;
	const __dirRight = 4;
	const __dirDownLeft = 5;
	const __dirDown = 6;
	const __dirDownRight = 7;
	const __line = [
		{ x: -1, y: -1, reverse: __dirDownRight },
		{ x: 0, y: -1, reverse: __dirDown },
		{ x: 1, y: -1, reverse: __dirDownLeft },
		{ x: -1, y: 0, reverse: __dirRight },
		{ x: 1, y: 0, reverse: __dirLeft },
		{ x: -1, y: 1, reverse: __dirUpRight },
		{ x: 0, y: 1, reverse: __dirUp },
		{ x: 1, y: 1, reverse: __dirUpLeft }
	];

	$scope.data = {
		grid: new Array(__boardSize),		
		placeDot: true,
		ordinal: 0,
		lineCount: 0,
		drawLine: false,
		drawLineStart: false,
		selectionX: null,
		selectionY: null,
		moves: []
	};

	Math.TAU = 2 * Math.PI;
	Math.Tan16th = Math.tan(Math.PI / 8);
	Math.TanThree16th = Math.tan(3 * Math.PI / 8)

	for (var i = 0; i < $scope.data.grid.length; i++)
	{
		$scope.data.grid[i] = new Array(__boardSize);
	}

	$q.all([
		dictionary.loader,
		serverComm.loader
	]).then(function()
	{
		serverComm.fetch('init').then(function(data)
		{
			angular.extend($scope.data, data);

			for (var i = 0; i < $scope.data.list.length; i++)
			{
				var item = $scope.data.list[i];
				$scope.data.grid[item.y][item.x] = item;
			}

			drawGrid();
		})
	});

	var board = document.getElementById('board');
	var _canvas = board.getContext('2d');

	_canvas.font = '8px Arial'
	_canvas.fillStyle = '#000';
	_canvas.lineWidth = 2;	


	$(board)
		.on('mousemove', function(event) {
			$scope.data.cursorX = event.offsetX - __gridOffset;
			$scope.data.cursorY = event.offsetY - __gridOffset;
			$scope.data.selectionX = parseInt($scope.data.cursorX / __gridSize + 0.5);
			$scope.data.selectionY = parseInt($scope.data.cursorY / __gridSize + 0.5);

			drawGrid();
		})
		.on('mousedown', function(event)
		{
			if (event.button === 0)
			{
				if (!$scope.data.placeDot && !$scope.data.drawLine && $scope.data.drawLineStart)
				{
					if ($scope.data.grid[$scope.data.selectionY][$scope.data.selectionX])
					{
						$scope.data.drawLine = true;
						$scope.data.drawLineStart = true;

						$scope.data.lineX = $scope.data.selectionX;
						$scope.data.lineY = $scope.data.selectionY;

						drawGrid();
					}
				}
			}
			else if (event.button === 2)
			{
				if (!$scope.data.placeDot && !$scope.data.drawLineStart)
				{
					$scope.data.drawLine = false;
					$scope.data.drawLineStart = true;

					drawGrid();
				}
				else
				{
					undo();
				}
			}

			event.preventDefault();
			return false;
		})
		.on('mouseup', function(event)
		{
			if (event.button !== 0)
			{
				event.preventDefault();
				return false;
			}
			if ($scope.data.placeDot)
			{
				if ($scope.data.grid[$scope.data.selectionY][$scope.data.selectionX] == null)
				{
					var item = {
						x: $scope.data.selectionX,
						y: $scope.data.selectionY,
						line: [0, 0, 0, 0, 0, 0, 0, 0],
						ordinal: ++$scope.data.ordinal
					}
					$scope.data.grid[$scope.data.selectionY][$scope.data.selectionX] = item; 
					$scope.data.list.push(item);

					$timeout(function()
					{
						$scope.data.placeDot = false;
					});
					$scope.data.drawLine = false;
					$scope.data.drawLineStart = true;

					$scope.data.moves.push({
						dot: 1,
						x: $scope.data.selectionX,
						y: $scope.data.selectionY
					});
				}
			}
			else if ($scope.data.drawLineStart)
			{
				$scope.data.drawLineStart = false;
				$scope.data.drawLineStart = false;
			}
			else if ($scope.data.drawLine)
			{
				var line = checkLine();

				if (line.ok)
				{
					var ix = $scope.data.lineX;
					var iy = $scope.data.lineY;

					$scope.data.moves.push({
						x: ix,
						y: iy,
						dir: line.direction
					});

					for (var i = 0; i <= __lineLength; i++)
					{
						if (i < __lineLength)
						{
							$scope.data.grid[iy][ix].line[line.direction] = 1;
						}
						if (i > 0)
						{
							$scope.data.grid[iy][ix].line[line.reverse] = 1;
						}

						ix += line.x;
						iy += line.y;
					}

					$scope.data.drawLine = false;
					$scope.data.drawLineStart = false;

					$timeout(function()
					{
						$scope.data.placeDot = true;
						++$scope.data.lineCount;
					});
				}
			}

			drawGrid();
		});


	$scope.finish = function()
	{
		dialog.input(
			'enter-your-name',
			function(name)
			{
				if (name.length === 0)
				{
					return true;
				}

				serverComm.fetch(
					'submit',
					{
						board: 0,
						dots: 5,
						moves: $scope.data.moves,
						name: name
					}
				);
			}
		);
	};


	function drawGrid()
	{
		_canvas.clearRect(0, 0, __canvasSize, __canvasSize);

		var by = 0;
		var dy = __gridOffset;
		var line = {
			x: 0,
			y: 0,
			ok: false
		};

		if ($scope.data.drawLine)
		{
			line = checkLine();
		}

		for (var y = 0; y < __boardSize; y++)
		{
			var bx = 0;
			var dx = __gridOffset;

			for (var x = 0; x < __boardSize; x++)
			{
				var item = $scope.data.grid[by][bx];

				if (x === $scope.data.selectionX && y === $scope.data.selectionY)
				{
					drawItem(dx, dy, item, line);
				}
				else
				{
					board.style.cursor = 'default';
				}
				if (item != null)
				{
					defaultDot(dx, dy, item);
				}

				++bx;
				dx += __gridSize;
			}

			++by;
			dy += __gridSize;
		}


		function drawItem(dx, dy, item, line)
		{
			if ($scope.data.placeDot && item == null)
			{
				board.style.cursor = 'pointer';
				_canvas.beginPath();
				_canvas.arc(dx, dy, 7, 0, Math.TAU);
				_canvas.fill();
			}
			else
			{
				board.style.cursor = 'default';
			}
			if (!$scope.data.placeDot)
			{
				if ($scope.data.drawLine)
				{
					board.style.cursor = 'pointer';
					_canvas.beginPath();
					_canvas.lineWidth = 3;
					_canvas.moveTo(
						$scope.data.lineX * __gridSize + __gridOffset,
						$scope.data.lineY * __gridSize + __gridOffset
					);
					_canvas.lineTo(
						($scope.data.lineX + line.x * __lineLength) * __gridSize + __gridOffset,
						($scope.data.lineY + line.y * __lineLength) * __gridSize + __gridOffset
					);
					if (line.ok)
					{
						_canvas.strokeStyle = '#0a0';
						board.style.cursor = 'pointer';
					}
					else
					{
						_canvas.strokeStyle = '#c00';
						board.style.cursor = 'default';
					}
					_canvas.stroke();
				}
				else
				{
					board.style.cursor = (item != null ? 'pointer' : 'default');
					_canvas.beginPath();
					_canvas.moveTo(dx - __gridLine, dy - __gridLine);
					_canvas.lineTo(dx + __gridLine, dy + __gridLine);
					_canvas.moveTo(dx - __gridLine, dy + __gridLine);
					_canvas.lineTo(dx + __gridLine, dy - __gridLine);
					_canvas.moveTo(dx - __gridLine, dy);
					_canvas.lineTo(dx + __gridLine, dy);
					_canvas.moveTo(dx, dy - __gridLine);
					_canvas.lineTo(dx, dy + __gridLine);
					_canvas.strokeStyle = (item != null ? '#0a0' : '#c00');
					_canvas.lineWidth = 3;
					_canvas.stroke();
				}
			} // if (!$scope.data.placeDot)

		} // function drawItem()

		function defaultDot(dx, dy, item)
		{
			_canvas.beginPath();
			_canvas.arc(dx, dy, 7, 0, Math.TAU);
			_canvas.lineWidth = 1;
			_canvas.strokeStyle = '#000';
			_canvas.stroke();

			if (item.ordinal)
			{
				var ordinal = item.ordinal.toString();		
				_canvas.fillText(ordinal, dx - parseInt(_canvas.measureText(ordinal).width / 2), dy + 3);
			}

			_canvas.beginPath();
			_canvas.lineWidth = 3;

			if (item.line[__dirUp])
			{
				_canvas.moveTo(dx, dy - 7);
				_canvas.lineTo(dx, dy - __gridSize / 2);
			}
			if (item.line[__dirUpRight])
			{
				_canvas.moveTo(dx + 5, dy - 5);
				_canvas.lineTo(dx + __gridSize / 2, dy - __gridSize / 2);
			}
			if (item.line[__dirRight])
			{
				_canvas.moveTo(dx + 7, dy);
				_canvas.lineTo(dx + __gridSize / 2, dy);
			}
			if (item.line[__dirDownRight])
			{
				_canvas.moveTo(dx + 5, dy + 5);
				_canvas.lineTo(dx + __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirDown])
			{
				_canvas.moveTo(dx, dy + 7);
				_canvas.lineTo(dx, dy + __gridSize / 2);
			}
			if (item.line[__dirDownLeft])
			{
				_canvas.moveTo(dx - 5, dy + 5);
				_canvas.lineTo(dx - __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirLeft])
			{
				_canvas.moveTo(dx - 7, dy);
				_canvas.lineTo(dx - __gridSize / 2, dy);
			}
			if (item.line[__dirUpLeft])
			{
				_canvas.moveTo(dx - 5, dy - 5);
				_canvas.lineTo(dx - __gridSize / 2, dy - __gridSize / 2);
			}
			_canvas.stroke();
		} // function defaultDot()

	} // function drawGrid()

	function undo()
	{
		if ($scope.data.moves.length > 0)
		{
			var undo = $scope.data.moves.pop();

			if (undo.dot)
			{
				delete $scope.data.grid[undo.y][undo.x]; 
				--$scope.data.ordinal;
				$scope.data.list.pop();
				$scope.data.placeDot = true;
			}
			else
			{
				var line = __line[undo.dir];

				for (var i = 0; i <= __lineLength; i++)
				{
					if (i < __lineLength)
					{
						$scope.data.grid[undo.y][undo.x].line[undo.dir] = 0;
					}
					if (i > 0)
					{
						$scope.data.grid[undo.y][undo.x].line[line.reverse] = 0;
					}

					undo.x += line.x;
					undo.y += line.y;
				}

				$scope.data.drawLine = false;
				$scope.data.drawLineStart = true;
				$scope.data.placeDot = false;				
			}

			drawGrid();
		}
	}

	function checkLine()
	{
		var dx = ($scope.data.selectionX - $scope.data.lineX) * __gridSize; 
		var dy = ($scope.data.selectionY - $scope.data.lineY) * __gridSize;
		var tan = (dx !== 0 ? dy / dx : dy);
		var output = { x: 0, y: 0, direction: 0, reverse: 0, ok: false };

		if (dx  < 0)
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirUpLeft;
				output.reverse = __dirDownRight;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirLeft;
				output.reverse = __dirRight;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirDownLeft;
				output.reverse = __dirUpRight
			}
			else
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
		}
		else
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirDownRight;
				output.reverse = __dirUpLeft;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirRight;
				output.reverse = __dirLeft;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirUpRight;
				output.reverse = __dirDownLeft;
			}
			else
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
		}

		output.x = __line[output.direction].x;
		output.y = __line[output.direction].y;

		var ix = $scope.data.lineX;
		var iy = $scope.data.lineY;

		for (var i = 0; i <= __lineLength; i++)
		{
			if (check(ix, iy, output.direction, output.reverse, i === 0, i === __lineLength))
			{
				return output;
			}

			ix += output.x;
			iy += output.y;
		}

		output.ok = true;

		return output;

		function check(x, y, direction, reverse, first, last)
		{
			if ($scope.data.grid[y][x] == null)
			{
				return true;
			}
			if (!last && $scope.data.grid[y][x].line[direction])
			{
				return true;
			}
			if (!first && $scope.data.grid[y][x].line[reverse])
			{
				return true;
			}
			return false;
		}

	} // function checkLine()

});