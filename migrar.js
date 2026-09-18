import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

// CONEXÃO COM MYSQL
const mysqlConnection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'techshop'
});

// CONEXÃO COM MONGODB
const mongoClient = new MongoClient(process.env.MONGODB_URI);

try {
  await mongoClient.connect();

  const db = mongoClient.db('techshop');

  console.log('Conectado ao MongoDB!');

  // =========================
  // CLIENTES
  // =========================
  const [clientes] = await mysqlConnection.execute(
    'SELECT * FROM clientes'
  );

  await db.collection('clientes').deleteMany({});
  if (clientes.length > 0) {
    await db.collection('clientes').insertMany(clientes);
  }

  console.log(`Clientes migrados: ${clientes.length}`);

  // =========================
  // PEDIDOS
  // =========================
  const [pedidos] = await mysqlConnection.execute(
    'SELECT * FROM pedidos'
  );

  await db.collection('pedidos').deleteMany({});
  if (pedidos.length > 0) {
    await db.collection('pedidos').insertMany(pedidos);
  }

  console.log(`Pedidos migrados: ${pedidos.length}`);

  // =========================
  // PRODUTOS
  // =========================
  const [produtos] = await mysqlConnection.execute(
    'SELECT * FROM produtos'
  );

  await db.collection('produtos').deleteMany({});
  if (produtos.length > 0) {
    await db.collection('produtos').insertMany(produtos);
  }

  console.log(`Produtos migrados: ${produtos.length}`);

  // =========================
  // ITENS DOS PEDIDOS
  // =========================
  const [itens] = await mysqlConnection.execute(
    'SELECT * FROM itens_pedido'
  );

  await db.collection('itens_pedido').deleteMany({});
  if (itens.length > 0) {
    await db.collection('itens_pedido').insertMany(itens);
  }

  console.log(`Itens dos pedidos migrados: ${itens.length}`);

  console.log('================================');
  console.log('MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log('================================');

} catch (error) {
  console.error('Erro na migração:', error);
} finally {
  await mysqlConnection.end();
  await mongoClient.close();
}