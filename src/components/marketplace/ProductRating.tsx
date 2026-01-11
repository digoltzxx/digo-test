import { Star } from "lucide-react";

interface ProductRatingProps {
  rating: number;
  reviewCount: number;
}

const ProductRating = ({ rating, reviewCount }: ProductRatingProps) => {
  return (
    <div className="flex items-center gap-1">
      <span className="text-blue-400 font-medium text-sm">{rating}</span>
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      <span className="text-gray-500 text-sm">({reviewCount})</span>
    </div>
  );
};

export default ProductRating;
