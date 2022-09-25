const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Convery db to obj

const convertDbToObj = (e) => {
  return {
    stateId: e.state_id,
    stateName: e.state_name,
    population: e.population,
  };
};

const convertDdDistToObj = (e) => {
  return {
    districtId: e.district_id,
    districtName: e.district_name,
    stateId: e.state_id,
    cases: e.cases,
    cured: e.cured,
    active: e.active,
    deaths: e.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//GET states API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const dbResponse = await db.all(getStatesQuery);
  const arr = dbResponse.map((e) => ({
    stateId: e.state_id,
    stateName: e.state_name,
    population: e.population,
  }));
  response.send(arr);
});

//GET state API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id=${stateId};`;
  const dbRes = await db.get(getStateQuery);
  //console.log(dbRes);
  const arr = convertDbToObj(dbRes);
  response.send(arr);
});

//Create district API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  console.log(districtName);
  const createDistQuery = `
    INSERT INTO district 
    (state_id,district_name,cases,cured,active,deaths)
    VALUES (${stateId},'${districtName}',${cases},${cured},${active},${deaths});`;
  const dbRes = await db.run(createDistQuery);
  response.send("District Successfully Added");
});

//GET district API

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistQuery = `
    SELECT * FROM district WHERE district_id=${districtId};`;
    const dbRes = await db.get(getDistQuery);
    const arr = convertDdDistToObj(dbRes);
    response.send(arr);
  }
);

//Delete API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `
    DELETE FROM district WHERE district_id=${districtId};`;
    const dbRes = await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

//Update API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistQuery = `
    UPDATE district SET 
    district_name='${districtName}',state_id=${stateId},
    cases=${cases},cured=${cured},active=${active},deaths=${deaths};`;
    const dbRes = await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//GET API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.body;
    const q = `
    SELECT SUM(cases) AS ${"totalCases"},SUM(cured) AS ${"totalCured"},SUM(active) AS ${"totalActive"},SUM(deaths) AS ${"totalDeaths"}
    FROM state INNER JOIN district ON state.state_id=district.state_id;`;
    const dbRes = await db.get(q);
    response.send(dbRes);
  }
);

module.exports = app;
