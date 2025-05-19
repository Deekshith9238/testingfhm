import { ChangeEvent, useRef, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { ImagePlus, X } from "lucide-react";

interface FileUploadProps {
  onChange: (file: File | null) => void;
  value?: File | null;
  defaultPreview?: string;
  className?: string;
}

export function FileUpload({ onChange, value, defaultPreview, className = "" }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(defaultPreview || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB
        alert('File size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onChange(file);
    } else {
      setPreview(null);
      onChange(null);
    }
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setPreview(null);
    onChange(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2"
        >
          <ImagePlus className="h-4 w-4" />
          Choose Image
        </Button>
        {(preview || value) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {preview && (
        <div className="relative w-32 h-32 rounded-full overflow-hidden border">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
} 