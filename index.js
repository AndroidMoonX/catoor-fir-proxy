import express from "express";
import admin from "firebase-admin";
import mqtt from "mqtt";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-test-1ab51-default-rtdb.firebaseio.com/"
});
const db = admin.database();

const app = express();
app.use(express.json());

// Middleware CORS MANUAL (sin paquetes externos)
app.use((req, res, next) => {
  // Solo aplica CORS a /mode
  if (req.path === "/mode") {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
  }
  
  // Manejo de preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  console.log(`Recibida petición: ${req.method} ${req.url}`, req.body);
  next();
});

// MQTT setup (INALTERADO)
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe('catoor/servoState/set');
});

mqttClient.on('error', (err) => {
  console.error('Error en MQTT:', err);
});

mqttClient.on('message', async (topic, message) => {
  if (topic === 'catoor/servoState/set') {
    const state = message.toString();
    if (['open', 'close'].includes(state)) {
      await db.ref('servoState').set(state);
      console.log(`servoState actualizado en Firebase desde MQTT: ${state}`);
    }
  }
});

// Firebase listener (INALTERADO)
const servoRef = db.ref('servoState');
servoRef.on('value', (snapshot) => {
  const state = snapshot.val();
  if (state) {
    mqttClient.publish('catoor/servoState/get', state);
    console.log(`Publicado estado en MQTT para Arduino: ${state}`);
  }
});

// Endpoint /mode (CORREGIDO)
app.post('/mode', (req, res) => {
  console.log("Llegó petición a /mode", req.body); // Debug
  
  try {
    const { mode } = req.body;
    if (!mode) throw new Error("No se recibió 'mode'");
    
    console.log("Publicando en MQTT..."); // Debug
    mqttClient.publish('catoor/arduino/mode', mode, { qos: 1 }, (err) => {
      if (err) {
        console.error("Error MQTT:", err); // Debug
        return res.status(500).json({ error: "Error MQTT", details: err.message });
      }
      console.log("Publicación MQTT exitosa"); // Debug
      res.json({ success: true, mode });
    });
    
  } catch (error) {
    console.error("Error en /mode:", error); // Debug
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});


