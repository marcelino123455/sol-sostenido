// API de mensajes: GET /mensajes?fecha=AAAA-MM-DD y POST /mensajes
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { estadoPara, fechaPeru, fechaValida, ulid, validarMensaje } from "./logica.mjs";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLA = process.env.TABLA_MENSAJES;

const responder = (statusCode, cuerpo) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(cuerpo),
});

async function listar(fecha) {
  if (!fechaValida(fecha)) return responder(400, { error: "Fecha no válida (AAAA-MM-DD)" });
  const mensajes = [];
  let desde;
  do {
    const r = await db.send(new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "#f = :f",
      FilterExpression: "#e = :aprobado",
      ProjectionExpression: "#f, id, universidad, #t, nombre",
      ExpressionAttributeNames: { "#f": "fecha", "#e": "estado", "#t": "texto" },
      ExpressionAttributeValues: { ":f": fecha, ":aprobado": "aprobado" },
      ExclusiveStartKey: desde,
    }));
    mensajes.push(...r.Items);
    desde = r.LastEvaluatedKey;
  } while (desde);
  return responder(200, { mensajes });
}

async function crear(evento) {
  let cuerpo;
  try {
    const crudo = evento.isBase64Encoded ? Buffer.from(evento.body ?? "", "base64").toString() : evento.body;
    cuerpo = JSON.parse(crudo ?? "");
  } catch {
    return responder(400, { error: "El cuerpo debe ser JSON" });
  }
  const { error, datos } = validarMensaje(cuerpo);
  if (error) return responder(400, { error });

  const estado = estadoPara(cuerpo.codigo, process.env.CODIGO_APROBACION);
  const item = { fecha: fechaPeru(), id: ulid(), estado, ...datos };
  await db.send(new PutCommand({ TableName: TABLA, Item: item }));
  return responder(201, { id: item.id, fecha: item.fecha, estado });
}

export async function handler(evento) {
  const { method, path } = evento.requestContext.http;
  if (path !== "/mensajes") return responder(404, { error: "Ruta no encontrada" });
  try {
    if (method === "GET") return await listar(evento.queryStringParameters?.fecha);
    if (method === "POST") return await crear(evento);
    return responder(405, { error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    return responder(500, { error: "No se pudo procesar la petición" });
  }
}
