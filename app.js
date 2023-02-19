const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server Running at localhost://3000/"));
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

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
    jwt.verify(jwtToken, "hari", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.post("/register/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserExist = `
    SELECT * FROM user WHERE username='${username}';`;
  const check = db.get(checkUserExist);

  if (check === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
        INSERT INTO user(username,password)
        VALUES ('${username}','${hashedPassword}');`;
    await db.run(insertQuery);
    response.send("Added Successfully");
  } else {
    response.send("user exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
  SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "hari");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const stateQuery = `
    SELECT 
      *
    FROM 
      state;`;
  const stateArray = await db.all(stateQuery);
  response.send(stateArray.map((sta) => convertDbObjectToResponseObject(sta)));
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT
      *
    FROM
      state
    WHERE state_id=${stateId};`;
  const state1 = await db.get(stateQuery);
  response.send(convertDbObjectToResponseObject(state1));
});

const convertDistrictObjectToResponseObject = (dist) => {
  return {
    districtId: dist.district_id,
    districtName: dist.district_name,
    stateId: dist.state_id,
    cases: dist.cases,
    cured: dist.cured,
    active: dist.active,
    deaths: dist.deaths,
  };
};

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addQuery = `
    INSERT INTO
      district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const district1 = await db.run(addQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT
      *
    FROM
      district
    WHERE district_id=${districtId};`;
    const district1 = await db.get(districtQuery);
    response.send(convertDistrictObjectToResponseObject(district1));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE
    FROM
      district
    WHERE district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

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
    const updateQuery = `
    UPDATE 
      district
    SET 
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE district_id=${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const state2 = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE district.state_id=${stateId};`;
    const totalCasesInStates = await db.get(state2);
    response.send(totalCasesInStates);
  }
);

module.exports = app;

