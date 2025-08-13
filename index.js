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

// Middleware para loguear peticiones
app.use((req, res, next) => {
  console.log(`Recibida petición: ${req.method} ${req.url}`, req.body);
  next();
});

// MQTT setup
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); // Cambia si quieres

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe('catoor/servoState/set');

  // Solo iniciar servidor cuando MQTT esté listo
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });
});

mqttClient.on('error', (err) => {
  console.error('Error en MQTT:', err);
});

mqttClient.on('close', () => {
  console.warn('Conexión MQTT cerrada');
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

// Endpoint para cambiar modo
app.post('/mode', (req, res) => {
  console.log('Entró al endpoint /mode con body:', req.body);
  console.log('Estado conexión MQTT:', mqttClient.connected);

  if (!mqttClient.connected) {
    console.log('MQTT no está conectado, rechazando petición /mode');
    return res.status(503).json({ error: 'MQTT no conectado' });
  }

  const { mode } = req.body;

  if (mode !== 'addTag' && mode !== 'normal') {
    console.log('Modo inválido recibido:', mode);
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


