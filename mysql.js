const $mysql = require('mysql');
const $sqlstring = require('sqlstring');
const Promise = require('./promise.js');

module.exports = function(config)
{
	let _connection
	let _module = { starting: new Promise() };

	try
	{
		_connection = $mysql.createConnection(config);
		_connection.connect(function(error)
			{
				if (error)
				{
					_module.starting.reject(error.sqlMessage);
					return;
				}
				_module.starting.resolve();
			});
	}
	catch (exception)
	{
		_module.starting.reject(exception);
	}
	
	_module.query = function(sql, parameters)
		{
			let promise = new Promise();

			for (let p in parameters)
			{
				sql = sql.replace('@' + p, $sqlstring.escape(parameters[p]));
			}

			setTimeout(function() {
				_connection.query(
					sql,
					parameters,
					function(error, result, fields)
					{
						if (error)
						{
							promise.reject(error.sqlMessage);
							return;
						}
						promise.resolve({
							result: result,
							fields: fields
						});
					}
				);
			});
			
			return promise;
		};

	_module.verifyTable = function(name, columns, primaryKey)
		{
			let promise = new Promise();

			_module.query(
					'SELECT column_name FROM information_schema.columns WHERE table_name = @name;',
					{ 'name': name }
				)
				.success(function(data)
				{
					if (data.result.length === 0)
					{
						let sql = ['CREATE TABLE `', name, '` ('];
						let list = [];

						for (let c in columns)
						{
							list.push([' `', c, '` ', columns[c]].join(''));
						}

						sql.push(list.join(','));

						if (primaryKey)
						{
							sql.push(
								', PRIMARY KEY (',
								primaryKey.map(function(item)
								{
									return '`' + item + '`';
								}),
								')'
							);
						}

						sql.push(');');

						_module.query(sql.join(''))
							.success(function(data)
							{
								promise.resolve();
							})
							.fail(function(error)
							{
								promise.reject(error);
							});

						return;
					}

					for (let c in columns)
					{
						if (!data.result.some(function(item)
						{
							return item.column_name === c;
						}))
						{
							promise.reject('Column `' + c + '` was not found in the table `' + name + '`');
							return;
						}
					}

					promise.resolve();
				})
				.fail(function(error)
				{
					promise.reject(error);
				});

			return promise;
		};

	_module.insert = function (tableName, data)
		{
			return _module.query(
				generateInsertSql('INSERT INTO ', tableName, data)
			);
		};

	_module.replace = function (tableName, data)
		{
			return _module.query(
				generateInsertSql('REPLACE INTO ', tableName, data)
			);
		};

	_module.encode = function(data)
		{
			return $sqlstring.escape(data);
		};

	return _module;

	function generateInsertSql(command, tableName, data)
	{
		let sql = [command, tableName, ' ('];
		let list = [];
					
		if (Array.isArray(data))
		{
			for (let d in data)
			{
				list.push(d);
			}

			sql.push(list.join(', '), ') VALUES ');

			list = [];
			
			for (let r = 0; r < data.length; r++)
			{
				list.push(
					[
						'(',
						addData(data[r]),
						')'
					].join('')
				);
			}

			sql.push(list.join(', '));
		}
		else 
		{
			for (let d in data)
			{
				list.push(d);
			}

			sql.push(list.join(', '), ') VALUES (', addData(data), ')');
		}

		return sql.join('');

		function addData(data)
		{
			let list = [];

			for (let d in data)
			{
				list.push($sqlstring.escape(data[d]));
			}

			return list.join(', ');
		}
	}
};
