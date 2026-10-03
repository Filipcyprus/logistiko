import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_API_TOKEN = process.env.SHOPIFY_API_TOKEN;

// Fetch all products and their inventory from Shopify
async function fetchShopifyInventory() {
  const query = `{
    products(first: 100) {
      edges {
        node {
          id
          title
          sku
          handle
          variants(first: 100) {
            edges {
              node {
                id
                sku
                barcode
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }`;

  const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_API_TOKEN,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${data.errors.map(e => e.message).join(", ")}`);
  }

  return data.data.products.edges.map(edge => edge.node);
}

// Match Shopify product to Logistiko product by SKU or barcode
function matchProduct(logistikoProducts, shopifyProduct) {
  for (const variant of shopifyProduct.variants.edges) {
    const v = variant.node;
    const sku = v.sku || shopifyProduct.sku;
    const barcode = v.barcode;

    if (sku) {
      const match = logistikoProducts.find(p => p.sku === sku);
      if (match) return { product: match, quantity: v.inventoryQuantity };
    }

    if (barcode) {
      const match = logistikoProducts.find(p => p.barcode === barcode);
      if (match) return { product: match, quantity: v.inventoryQuantity };
    }
  }

  return null;
}

export async function POST(request) {
  try {
    if (!SHOPIFY_STORE || !SHOPIFY_API_TOKEN) {
      return NextResponse.json({ error: "Shopify credentials not configured" }, { status: 400 });
    }

    const db = readDB();
    const shopifyProducts = await fetchShopifyInventory();

    let updated = 0;
    let skipped = 0;

    for (const shopifyProduct of shopifyProducts) {
      const match = matchProduct(db.products, shopifyProduct);
      if (match) {
        const oldStock = Number(match.product.stock || 0);
        match.product.stock = match.quantity;
        if (oldStock !== match.quantity) {
          updated++;
        }
      } else {
        skipped++;
      }
    }

    writeDB(db);

    const logEntry = {
      timestamp: new Date().toISOString(),
      syncedFrom: "shopify",
      updated,
      skipped,
      total: shopifyProducts.length,
    };

    return NextResponse.json({
      ok: true,
      message: `Synced ${updated} products, skipped ${skipped}`,
      ...logEntry,
    });
  } catch (error) {
    console.error("Shopify sync error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST to sync inventory from Shopify hourly" });
}
