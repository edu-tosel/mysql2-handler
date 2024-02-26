# mysql2-handler
The custom handler for [mysql2](https://github.com/sidorares/node-mysql2) module.

## Installation
```bash
npm install @edu-tosel/mysql2-handler
```

## Environment Variables
```bash
export DB_HOST='localhost'
export DB_USER='root'
export DB_PASSWORD='password'
export DB_NAME='database'
export DB_PORT='3306'
export DATE_STRINGS='DATE' # or 'DATETIME' or 'TIMESTAMP'
# ...export DATE_STRINGS='DATETIME'
export CONNECTION_LIMIT='10'
```

## Default configuration
* DB_HOST: None
* DB_USER: None
* DB_PASSWORD: None
* DB_NAME: None
* DB_PORT: 3306
* DATE_STRINGS: 'DATE'
* CONNECTION_LIMIT: 5
* TIMEZONE: 'UTC'

## Usage
```js
const mysqlHandler = require('@edu-tosel/mysql2-handler');
function select1(){
  return mysqlHandler.handler(async(connection)=>{
    const [rows, fields] = await connection.execute('SELECT 1 AS `one`');
    return rows; // [{one: 1}]
  });
}
select1().then(console.log).catch(console.error); // stdout: [{one: 1}]
```
