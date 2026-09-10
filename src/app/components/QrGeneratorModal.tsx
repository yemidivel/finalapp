import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, QrCode, Download } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../state/store";
import { downloadProductQrCode, buildProductQrValue } from "../../lib/qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface QrGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QrGeneratorModal({ isOpen, onClose }: QrGeneratorModalProps) {
  const { categories, inventoryArray, currentStore } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const availableProducts = useMemo(() => {
    return inventoryArray
      .filter(
        (product) => !selectedCategory || product.category === selectedCategory,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventoryArray, selectedCategory]);

  const selectedProduct = useMemo(
    () =>
      availableProducts.find(
        (product) => String(product.id) === selectedProductId,
      ),
    [availableProducts, selectedProductId],
  );

  useEffect(() => {
    if (!isOpen) return;

    const firstCategory = categories[0] || "";
    setSelectedCategory(firstCategory);
    setSelectedProductId("");
    setIsGenerating(false);
  }, [isOpen, categories]);

  useEffect(() => {
    setSelectedProductId("");
  }, [selectedCategory]);

  const handleGenerate = async () => {
    if (!selectedProduct) {
      toast.error("Select a product first");
      return;
    }

    setIsGenerating(true);

    downloadProductQrCode(selectedProduct);
    toast.success(`QR code downloaded for ${selectedProduct.name}`);
    setIsGenerating(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-w-[calc(100%-2rem)] rounded-[2rem] border-none p-0 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 sm:p-8 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl sm:text-2xl font-black text-gray-900">
                Generate QR Code
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-medium mt-1 text-sm">
                Choose a category and product, then download a SellSync QR code
                for quick scanning.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 sm:p-8 bg-gray-50/40 space-y-6 overflow-y-auto min-h-0 flex-1">
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="space-y-2.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Category
              </Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="h-12 rounded-xl bg-white border-gray-200 font-bold">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No categories available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Product
              </Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger className="h-12 rounded-xl bg-white border-gray-200 font-bold">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableProducts.length > 0 ? (
                    availableProducts.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No products in this category
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-indigo-100 bg-white p-5">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">
              Preview
            </p>
            {selectedProduct ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-36 h-36 sm:w-40 sm:h-40 bg-white p-2 rounded-2xl shadow-sm border border-indigo-50 flex items-center justify-center">
                  <QRCodeSVG
                    value={buildProductQrValue(selectedProduct)}
                    size={128}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#4F46E5"
                  />
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-black text-gray-900 truncate">
                      {selectedProduct.name}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full shrink-0">
                      {selectedProduct.category}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-medium text-gray-500">
                    <div className="truncate">
                      SKU:{" "}
                      <span className="font-black text-gray-900">
                        {selectedProduct.sku}
                      </span>
                    </div>
                    <div className="truncate">
                      Store:{" "}
                      <span className="font-black text-gray-900">
                        {currentStore.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 font-medium">
                Select a product to generate its QR code.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 bg-white border-t border-gray-100 gap-3 shrink-0">
          <Button
            variant="ghost"
            className="h-11 rounded-xl font-bold px-6"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2 shadow-lg shadow-indigo-100"
            onClick={handleGenerate}
            disabled={!selectedProduct || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isGenerating ? "Generating..." : "Download QR Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
