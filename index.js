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
  mqttClient.subscribe('catoor/arduino/tag'); // Suscribirse al topic de tags

  // Solo iniciar servidor cuando MQTT esté listo
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });
});

mqttClient.on('message', async (topic, message) => {
  const msgStr = message.toString();

  if (topic === 'catoor/servoState/set') {
    if (['open', 'close'].includes(msgStr)) {
      await db.ref('servoState').set(msgStr);
      console.log(`servoState actualizado en Firebase desde MQTT: ${msgStr}`);
    }
  } 
  else if (topic === 'catoor/arduino/tag') {
    const tagId = msgStr.trim();
    console.log(`Tag recibido desde Arduino: ${tagId}`);

    // Verificamos si el tag ya existe en la base
    const tagRef = db.ref('tags').child(tagId);
    const snapshot = await tagRef.once('value');
    if (!snapshot.exists()) {
      // Si no existe, creamos registro básico
      await tagRef.set({
        nombre: "Sin nombre",
        entradas: {},
        salidas: {}
      });
      console.log(`Nuevo tag guardado en Firebase: ${tagId}`);
    } else {
      console.log(`Tag ya existe: ${tagId}`);
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
  try {
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
      return res.json({ success: true, mode });
    });
  } catch (error) {
    console.error('Error en /mode:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

