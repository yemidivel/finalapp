import { useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "../../animations/variants";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Plus, ShoppingCart } from "lucide-react";
import {
  buildProductImageUrl,
  placeholderProductImage,
} from "../../lib/productImage";

type Product = {
  // Backend ids are UUID strings. Declaring this as `number` made every
  // `cart[id]` lookup type-inconsistent with the Record<string, number> cart.
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
  imageUrl?: string;
};

type Props = {
  product: Product;
  inCart?: number;
  onAdd: (id: string) => void;
};

export function ProductCard({ product, inCart = 0, onAdd }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const stockStatus =
    product.stock < 10 ? "critical" : product.stock < 30 ? "low" : "healthy";
  // Prefer the stored photo; generate one for products saved before images
  // existed. If the generator is unreachable, fall back to a plain placeholder.
  const imgSrc = imgFailed
    ? placeholderProductImage(product.name)
    : product.imageUrl || buildProductImageUrl(product.name);

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="cursor-pointer w-full"
    >
      <Card
          className={`group border-outline-variant/40 shadow-sm hover:shadow-md hover:border-primary-container/40 transition-all relative overflow-hidden rounded-2xl flex flex-col ${product.stock === 0 ? "opacity-60" : ""}`}
          onClick={() => product.stock > 0 && onAdd(product.id)}
        >
          {inCart > 0 && (
            <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-primary-fixed text-primary-container rounded-full flex items-center justify-center font-black text-xs shadow-lg ring-4 ring-surface-container-lowest">
              {inCart}
            </div>
          )}

          <div className="aspect-[5/4] bg-surface-container flex items-center justify-center overflow-hidden relative">
            <img
              src={imgSrc}
              alt={product.name}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover scale-[1.2] group-hover:scale-[1.26] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] flex items-center justify-center">
                <Badge
                  variant="destructive"
                  className="px-3 py-1 text-xs font-black uppercase tracking-widest shadow-xl"
                >
                  Out of Stock
                </Badge>
              </div>
            )}
            {product.stock > 0 && product.stock < 10 && (
              <div className="absolute top-3 left-3">
                <Badge variant="destructive" className="text-[10px]">
                  Low Stock
                </Badge>
              </div>
            )}
          </div>

          <CardContent className="p-4 flex-1 flex flex-col gap-3">
            <div className="min-h-[3.3rem]">
              <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight">
                {product.name}
              </h3>
              <p className="text-[10px] font-medium text-on-surface-variant truncate mt-0.5">
                {product.sku}
              </p>
            </div>

            <div className="flex items-end justify-between">
              <p className="text-xl font-black text-gray-900">
                ₦{product.price.toFixed(2)}
              </p>
              <p
                className={`text-[10px] font-bold uppercase ${
                  stockStatus === "critical"
                    ? "text-red-500"
                    : stockStatus === "low"
                    ? "text-orange-500"
                    : "text-green-600"
                }`}
              >
                {product.stock} in stock
              </p>
            </div>

            <Progress
              value={(product.stock / 150) * 100}
              className={`h-1.5 ${
                stockStatus === "critical"
                  ? "[&>div]:bg-red-500"
                  : stockStatus === "low"
                  ? "[&>div]:bg-orange-500"
                  : "[&>div]:bg-green-500"
              }`}
            />

            <Button
              className="group/add mt-auto w-full h-10 rounded-xl justify-between bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold gap-2 shadow-sm"
              disabled={product.stock === 0}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(product.id);
              }}
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </span>
              <span className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-700 group-hover/add:rotate-[180deg]">
                <Plus className="w-4 h-4" />
              </span>
            </Button>
          </CardContent>
        </Card>
    </motion.div>
  );
}
