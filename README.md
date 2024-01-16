# mysql2-handler
The custom handler for [mysql2](https://github.com/sidorares/node-mysql2) module.

## Installation
```bash
npm install @edu-tosel/mysql2-handler
```
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
