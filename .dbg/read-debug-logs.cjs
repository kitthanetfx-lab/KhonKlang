require('dotenv').config({ path: '.env.local' });
const { Client, Databases, Query } = require('node-appwrite');

async function main() {
  const targetCallId = process.argv[2] || '';
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const res = await db.listDocuments('khonklang_db', 'call_signals', [
    Query.orderDesc('createdAt'),
    Query.limit(200),
  ]);

  const docs = res.documents
    .filter((doc) => doc.type === 'debug')
    .map((doc) => ({
      id: doc.$id,
      threadId: doc.threadId,
      fromRole: doc.fromRole,
      createdAt: doc.createdAt,
      payload: JSON.parse(String(doc.data || '{}')),
    }))
    .filter((doc) => !targetCallId || doc.payload.callId === targetCallId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((doc) => ({
      id: doc.$id,
      threadId: doc.threadId,
      fromRole: doc.fromRole,
      createdAt: doc.createdAt,
      location: doc.payload.location,
      msg: doc.payload.msg,
      data: doc.payload.data,
      callId: doc.payload.callId,
    }));

  process.stdout.write(`${JSON.stringify(docs, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
