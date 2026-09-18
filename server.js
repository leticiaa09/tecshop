import express from 'express';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega o dotenv apenas se não estiver em produção (evita erro na Vercel onde o .env não existe fisicamente)
if (process.env.NODE_ENV !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração para servir o Frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ===============================
// CONEXÃO COM MONGODB (Serverless Ready)
// ===============================

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  console.error('ERRO: A variável de ambiente MONGODB_URI ou MONGO_URI não está definida!');
}

const client = new MongoClient(uri, {
  family: 4
});

let db;

async function conectarBanco() {
  if (db) return db; // Reutiliza a conexão se já estiver aberta (otimização serverless)
  
  try {
    await client.connect();
    db = client.db('techshop');
    console.log('MongoDB conectado com sucesso!');
    return db;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

// Middleware global para garantir que o banco está conectado em cada requisição na Vercel
app.use(async (req, res, next) => {
  try {
    if (!db) {
      await conectarBanco();
    }
    next();
  } catch (error) {
    res.status(500).json({ erro: 'Falha na conexão com o banco de dados.' });
  }
});

// ===============================
// CONTROLE DE ACESSO
// ===============================

const verificarAcesso = (nivelRequerido) => {
  return (req, res, next) => {
    const nivelUsuario = req.headers['user-level'];

    if (!nivelUsuario) {
      return res.status(401).json({
        erro: 'Usuário não identificado.'
      });
    }

    if (
      nivelRequerido === 'Admin' &&
      nivelUsuario !== 'Admin'
    ) {
      return res.status(403).json({
        erro: 'Acesso negado. Apenas Administradores podem alterar dados.'
      });
    }

    next();
  };
};

// ===============================
// RELATÓRIO DE VENDAS
// ===============================

app.get('/api/relatorio-vendas', async (req, res) => {
  try {
    const pedidos = await db.collection('pedidos').aggregate([
      {
        $lookup: {
          from: 'clientes',
          localField: 'id_cliente',
          foreignField: 'id_cliente',
          as: 'cliente'
        }
      },
      {
        $unwind: '$cliente'
      },
      {
        $lookup: {
          from: 'itens_pedido',
          localField: 'id_pedido',
          foreignField: 'id_pedido',
          as: 'itens'
        }
      },
      {
        $unwind: '$itens'
      },
      {
        $group: {
          _id: '$id_pedido',
          id_pedido: {
            $first: '$id_pedido'
          },
          nome_cliente: {
            $first: '$cliente.nome'
          },
          total_pedido: {
            $sum: {$multiply: [
                { $toDouble: '$itens.quantidade' },
                { $toDouble: '$itens.preco_unitario' }
              ]
            }
          },
          status_pedido: {
            $first: '$status_pedido'
          }
        }
      },
      {
        $project: {           _id: 0,           id_pedido: 1,           nome_cliente: 1,           total_pedido: 1,           status_pedido: 1         }       },       {$sort: {
          id_pedido: 1
        }
      }
    ]).toArray();

    res.json(pedidos);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      erro: error.message
    });
  }
});

// ===============================
// ESTOQUE
// ===============================

app.get('/api/estoque', async (req, res) => {
  try {
    const estoque = await db.collection('produtos').aggregate([
      {
        $lookup: {
          from: 'itens_pedido',
          localField: 'id_produto',
          foreignField: 'id_produto',
          as: 'itens'
        }
      },
      {
        $addFields: {
          total_unidades_vendidas: {
            $sum: '$itens.quantidade'
          }
        }
      },
      {
        $project: {
          _id: 0,
          id_produto: 1,
          nome_produto: 1,
          estoque_atual: '$estoque',
          total_unidades_vendidas: 1
        }
      },
      {
        $sort: {
          id_produto: 1
        }
      }
    ]).toArray();

    res.json(estoque);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      erro: error.message
    });
  }
});

// ===============================
// ALTERAR ESTOQUE
// SOMENTE ADMIN
// ===============================

app.put(
  '/api/produtos/:id',
  verificarAcesso('Admin'),
  async (req, res) => {
    try {
      const idProduto = parseInt(req.params.id);
      const novoEstoque = parseInt(req.body.novoEstoque);

      if (isNaN(idProduto) || isNaN(novoEstoque)) {
        return res.status(400).json({
          erro: 'ID do produto ou estoque inválido.'
        });
      }

      if (novoEstoque < 0) {
        return res.status(400).json({
          erro: 'O estoque não pode ser negativo.'
        });
      }

      const resultado = await db.collection('produtos').updateOne(
        {
          id_produto: idProduto
        },
        {
          $set: {
            estoque: novoEstoque
          }
        }
      );

      if (resultado.matchedCount === 0) {
        return res.status(404).json({
          erro: 'Produto não encontrado.'
        });
      }

      res.json({
        mensagem: 'Estoque atualizado com sucesso!',
        id_produto: idProduto,
        novoEstoque: novoEstoque
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        erro: error.message
      });
    }
  }
);

// ===============================
// EXPORTAÇÃO / INICIALIZAÇÃO
// ===============================

// Se estiver rodando localmente, inicia o listen na porta 3000
if (process.env.NODE_ENV !== 'production') {
  conectarBanco().then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor TechShop rodando em http://localhost:${PORT}`);
    });
  });
}

// Exporta o app para a Vercel gerenciar as rotas serverless corretamente
export default app;