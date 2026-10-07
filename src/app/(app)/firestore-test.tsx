import { useState } from "react";
import { Button, Text, View } from "react-native";

import { addDocument } from "@/services/firestore";

export default function FirestoreTestScreen() {
  const [message, setMessage] = useState("Sin probar");

  async function testFirestore() {
    try {
      const id = await addDocument("test", {
        mensaje: "Firebase funciona correctamente",
        fecha: new Date().toISOString(),
      });

      setMessage(`Documento creado: ${id}`);
    } catch (error) {
      console.error(error);
      setMessage("Error al guardar en Firestore");
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text>{message}</Text>

      <Button title="Probar Firestore" onPress={testFirestore} />
    </View>
  );
}
