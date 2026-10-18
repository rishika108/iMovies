import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';

export default function StarRating({
  rating = 0,
  maxStars = 5,
  onRate,
  readOnly = !onRate,
  size = '1rem'
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (starIndex) => {
    if (!readOnly && onRate) {
      onRate(starIndex);
    }
  };

  const handleMouseEnter = (starIndex) => {
    if (!readOnly) {
      setHoverRating(starIndex);
    }
  };

  const handleMouseLeave = () => {
    if (!readOnly) {
      setHoverRating(0);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div
      className="d-inline-flex align-items-center gap-1"
      onMouseLeave={handleMouseLeave}
      style={{ cursor: readOnly ? 'default' : 'pointer' }}
      aria-label={`Rating: ${rating} out of ${maxStars}`}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        const isFilled = activeRating >= starValue;
        const isHalf = !isFilled && activeRating >= starValue - 0.5;

        return (
          <span
            key={index}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            style={{
              fontSize: size,
              color: isFilled || isHalf ? '#f39c12' : '#444444',
              transition: 'transform 0.15s ease, color 0.15s ease',
              transform: !readOnly && hoverRating >= starValue ? 'scale(1.2)' : 'none'
            }}
          >
            <FontAwesomeIcon icon={faStarSolid} />
          </span>
        );
      })}
    </div>
  );
}
