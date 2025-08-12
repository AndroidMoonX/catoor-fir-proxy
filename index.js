import express from "express";
import admin from "firebase-admin";

const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJSON) {
  throw new Error("No se encontró la variable FIREBASE_SERVICE_ACCOUNT");
}
const serviceAccount = JSON.parse(serviceAccountJSON);

const app = express();
app.use(express.json());

// Inicializar Firebase Admin con RTDB
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-test-1ab51-default-rtdb.firebaseio.com/" // Cambia por tu URL RTDB
});
const db = admin.database();

// POST /servo → Cambia el estado
app.post("/servo", async (req, res) => {
  const { state } = req.body;
  if (!["open", "close"].includes(state)) {
    return res.status(400).send("Estado inválido. Usa 'open' o 'close'.");
  }
  try {
    await db.ref("servoState").set(state);  // Aquí cambiamos la ruta
    console.log(`servoState actualizado a ${state}`);
    res.send(`servoState actualizado a ${state}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error escribiendo en RTDB");
  }
});

// GET /servo → Devuelve el estado
app.get("/servo", async (req, res) => {
  try {
    const snapshot = await db.ref("servoState").once("value");  // Aquí también
    const state = snapshot.val() || "close";
    res.send(state);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error leyendo en RTDB");
  }
});


// Servidor local en puerto 3000
app.listen(3000, () => {
  console.log("Servidor local en http://localhost:3000");
});
