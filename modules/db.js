import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

const poolnewdb = new Pool({
  user: process.env.DB_USER,
  host: process.env.HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log(process.env.DB_DATABASE);

const dbQuery = await poolnewdb.query(
  `SELECT FROM pg_database WHERE datname = $1`,
  [process.env.DB_DATABASE]
);
if (dbQuery.rows.length === 0) {
  // database does not exist, make it:
  await poolnewdb.query(`CREATE DATABASE ${process.env.DB_DATABASE}`);
  console.log(`Database ${process.env.DB_DATABASE} created!`);
}

// create table "history"
pool.query(
  `CREATE TABLE IF NOT EXISTS "history" (
      "chatid" VARCHAR(20) NOT NULL,
	    "date" TIMESTAMP NOT NULL DEFAULT NOW(),
	    "command" VARCHAR(100),  
	    "text" VARCHAR(500),                 
	    PRIMARY KEY (chatid, date)
     )`,
  (err, res) => {
    if (err) {
      console.log(err.stack);
      throw err;
    } else {
    }
  }
);

// ************************************
// FUNCTIONS
// ************************************

// FUNCTION savehistory
const savehistory = async (userid, command, text) => {
  const query = `INSERT INTO history (chatid, command, text)
                 VALUES ('${userid.toString()}', '${command}', '${text}');`;

  const client = await pool.connect();
  try {
    const res = await client.query(query);
    return true;
  } catch (err) {
    console.log(err.stack);
    return false;
  } finally {
    client.release();
  }
};

pool.connect(); // ����� �������� � ��� ����

export { pool, savehistory };
