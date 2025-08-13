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

// Configuración CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// MQTT Setup
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

// Configuración de tópicos MQTT
const TOPICS = {
  SERVO_SET: 'catoor/servoState/set',
  SERVO_GET: 'catoor/servoState/get',
  ARDUINO_MODE: 'catoor/arduino/mode',
  NEW_TAG: 'catoor/arduino/newTag'  // 👈 Nuevo tópico para tags RFID
};

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  // Suscribirse a los tópicos necesarios
  mqttClient.subscribe(TOPICS.SERVO_SET);
  console.log(`Suscrito a ${TOPICS.SERVO_SET}`);
});

mqttClient.on('error', (err) => {
  console.error('Error en MQTT:', err);
});

// Manejo de mensajes MQTT
mqttClient.on('message', async (topic, message) => {
  const msg = message.toString();
  console.log(`MQTT recibido - Tópico: ${topic}, Mensaje: ${msg}`);

  try {
    if (topic === TOPICS.SERVO_SET) {
      // Manejo del estado del servo
      if (['open', 'close'].includes(msg)) {
        await db.ref('servoState').set(msg);
        console.log(`servoState actualizado en Firebase: ${msg}`);
      }
    }
    else if (topic === TOPICS.NEW_TAG) {  // 👈 Manejo de nuevos tags
      console.log(`Nuevo tag RFID recibido: ${msg}`);
      
      // Guardar en Firebase bajo /tags/{tagId}
      const tagRef = db.ref(`tags/${msg}`);
      await tagRef.set({
        timestamp: admin.database.ServerValue.TIMESTAMP,
        status: "registered"
      });
      console.log(`Tag ${msg} guardado en Firebase`);
      
      // Opcional: Cambiar automáticamente a modo normal
      await db.ref('arduinoMode').set("normal");
    }
  } catch (error) {
    console.error(`Error procesando ${topic}:`, error);
  }
});

// Listeners de Firebase para estados
const setupFirebaseListeners = () => {
  // Listener para servoState
  db.ref('servoState').on('value', (snapshot) => {
    const state = snapshot.val();
    if (state) {
      mqttClient.publish(TOPICS.SERVO_GET, state);
      console.log(`Estado servo publicado a MQTT: ${state}`);
    }
  });

  // Listener para arduinoMode
  db.ref('arduinoMode').on('value', (snapshot) => {
    const mode = snapshot.val();
    if (mode) {
      mqttClient.publish(TOPICS.ARDUINO_MODE, mode, { qos: 1 });
      console.log(`Modo publicado a MQTT: ${mode}`);
    }
  });
};

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  setupFirebaseListeners();
});
