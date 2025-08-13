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

// MQTT setup
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); //cambiar si quieres

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe('catoor/servoState/set');
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

// Firebase listener para cambios en servoState
const servoRef = db.ref('servoState');
servoRef.on('value', (snapshot) => {
  const state = snapshot.val();
  if (state) {
    mqttClient.publish('catoor/servoState/get', state);
    console.log(`Publicado estado en MQTT para Arduino: ${state}`);
  }
});

// NUEVO ENDPOINT /mode para controlar el modo de Arduino
app.post('/mode', (req, res) => {
  const { mode } = req.body;

  if (mode !== 'addTag' && mode !== 'normal') {
    return res.status(400).json({ error: 'Modo inválido. Debe ser "addTag" o "normal".' });
  }

  mqttClient.publish('catoor/arduino/mode', mode, (err) => {
    if (err) {
      console.error('Error publicando modo en MQTT:', err);
      return res.status(500).json({ error: 'Error publicando en MQTT' });
    }

    console.log(`Modo enviado a Arduino: ${mode}`);
    res.json({ success: true, mode });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
