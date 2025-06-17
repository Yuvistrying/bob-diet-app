import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export function ProfileEditModal({ isOpen, onClose, profile }: ProfileEditModalProps) {
  const updateField = useMutation(api.userProfiles.updateProfileField);
  
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    age: profile?.age || 30,
    height: profile?.height || 170,
    currentWeight: profile?.currentWeight || 70,
    targetWeight: profile?.targetWeight || 70,
    gender: profile?.gender || "other",
    activityLevel: profile?.activityLevel || "moderate",
    goal: profile?.goal || "maintain",
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Update each changed field
      for (const [field, value] of Object.entries(formData)) {
        if (profile?.[field] !== value) {
          await updateField({ field, value });
        }
      }
      onClose();
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal information and goals.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="age" className="text-right">
              Age
            </Label>
            <Input
              id="age"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 30 })}
              className="col-span-3"
              min="13"
              max="100"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="height" className="text-right">
              Height (cm)
            </Label>
            <Input
              id="height"
              type="number"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 170 })}
              className="col-span-3"
              min="100"
              max="250"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="currentWeight" className="text-right">
              Current Weight (kg)
            </Label>
            <Input
              id="currentWeight"
              type="number"
              value={formData.currentWeight}
              onChange={(e) => setFormData({ ...formData, currentWeight: parseFloat(e.target.value) || 70 })}
              className="col-span-3"
              min="30"
              max="300"
              step="0.1"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetWeight" className="text-right">
              Target Weight (kg)
            </Label>
            <Input
              id="targetWeight"
              type="number"
              value={formData.targetWeight}
              onChange={(e) => setFormData({ ...formData, targetWeight: parseFloat(e.target.value) || 70 })}
              className="col-span-3"
              min="30"
              max="300"
              step="0.1"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gender" className="text-right">
              Gender
            </Label>
            <Select 
              value={formData.gender} 
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="activity" className="text-right">
              Activity Level
            </Label>
            <Select 
              value={formData.activityLevel} 
              onValueChange={(value) => setFormData({ ...formData, activityLevel: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Light Exercise</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="active">Very Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="goal" className="text-right">
              Goal
            </Label>
            <Select 
              value={formData.goal} 
              onValueChange={(value) => setFormData({ ...formData, goal: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cut">Lose Weight</SelectItem>
                <SelectItem value="gain">Build Muscle</SelectItem>
                <SelectItem value="maintain">Maintain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}