"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import { Check, X, PenSquare } from "lucide-react";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { designTokens } from "~/app/design-system/tokens";
import { useHapticFeedback } from "~/app/design-system/hooks";

interface FoodItem {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  quantity?: string;
}

interface FoodConfirmationProps {
  confirmId: string;
  mealType: string;
  items: FoodItem[];
  totalCalories: number;
  isConfirmed: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onEdit?: (items: FoodItem[]) => void;
  editedItems?: FoodItem[];
}

export function FoodConfirmation({
  confirmId,
  mealType,
  items,
  totalCalories,
  isConfirmed,
  onConfirm,
  onReject,
  onEdit,
  editedItems,
}: FoodConfirmationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localItems, setLocalItems] = useState<FoodItem[]>(
    editedItems || items,
  );
  const { triggerHaptic } = useHapticFeedback();

  const handleConfirm = () => {
    triggerHaptic("medium");
    if (isEditing && onEdit) {
      onEdit(localItems);
      setIsEditing(false);
    }
    onConfirm();
  };

  const handleReject = () => {
    triggerHaptic("light");
    onReject();
  };

  const handleEdit = () => {
    triggerHaptic("light");
    setIsEditing(!isEditing);
    if (!isEditing) {
      setLocalItems(editedItems || items);
    }
  };

  const updateItem = (
    index: number,
    field: keyof FoodItem,
    value: string | number,
  ) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLocalItems(newItems);
  };

  const removeItem = (index: number) => {
    triggerHaptic("light");
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  const displayItems = isEditing ? localItems : editedItems || items;
  const displayTotal = isEditing
    ? localItems.reduce((sum, item) => sum + (item.calories || 0), 0)
    : editedItems?.reduce((sum, item) => sum + (item.calories || 0), 0) ||
      totalCalories;

  if (isConfirmed) {
    return (
      <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
        <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center flex-shrink-0">
          <Check className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body-small font-medium text-foreground">
            Logged {mealType}
          </div>
          <div className="text-caption text-foreground-secondary">
            {displayTotal} calories • {displayItems.length} items
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-elevated rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-body font-semibold text-foreground">
            Confirm {mealType}
          </h3>
          <p className="text-caption text-foreground-secondary mt-0.5">
            Review and confirm your food log
          </p>
        </div>
        <button
          onClick={handleEdit}
          className="w-8 h-8 flex items-center justify-center rounded-lg ios-button"
        >
          <PenSquare className="w-4 h-4 text-foreground-secondary" />
        </button>
      </div>

      {/* Food Items */}
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            {isEditing ? (
              <>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  className="flex-1 h-9 text-body-small"
                  placeholder="Food name"
                />
                <Input
                  type="number"
                  value={item.calories}
                  onChange={(e) =>
                    updateItem(index, "calories", parseInt(e.target.value) || 0)
                  }
                  className="w-20 h-9 text-body-small text-center"
                  placeholder="Cal"
                />
                <button
                  onClick={() => removeItem(index)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg ios-button"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-body-small text-foreground">
                  {item.quantity && `${item.quantity} `}
                  {item.name}
                </span>
                <span className="text-body-small font-medium text-foreground-secondary">
                  {item.calories} cal
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="pt-2 border-t border-separator">
        <div className="flex items-center justify-between">
          <span className="text-body font-medium text-foreground">Total</span>
          <span className="text-body font-semibold text-foreground">
            {displayTotal} calories
          </span>
        </div>
        {displayItems.some((item) => item.protein) && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-caption text-foreground-secondary">
              Protein
            </span>
            <span className="text-caption font-medium text-foreground-secondary">
              {displayItems.reduce((sum, item) => sum + (item.protein || 0), 0)}
              g
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          onClick={handleReject}
          variant="secondary"
          size="sm"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="default"
          size="sm"
          className="flex-1"
        >
          {isEditing ? "Save & Confirm" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
