import React from 'react';
import type { ItemType } from '../game/types';

interface ItemIconProps {
  item: ItemType;
  className?: string;
}

/**
 * 10 bespoke, unmistakable vector SVG symbols for every tableware item
 * used in the Top Symbol Bar, Level Selector, and modals.
 */
export const ItemIcon: React.FC<ItemIconProps> = ({ item, className = 'w-7 h-7' }) => {
  switch (item) {
    case 'knife':
      // Obědový nůž
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M19.5 4C15.5 4.6 13.5 8.2 13.5 13.5V18.5H18.5V4.8C18.5 4.3 19 4 19.5 4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path
            d="M15.5 18.5H18.5V26.5C18.5 27.6 17.6 28.5 16.5 28.5C15.4 28.5 14.5 27.6 14.5 26.5V20.5L15.5 18.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="16.5" y1="21.5" x2="16.5" y2="25.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'fork':
      // Obědová vidlička
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M11 4.5V12.5C11 15 13 16.5 16 16.5C19 16.5 21 15 21 12.5V4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="14.3" y1="4.5" x2="14.3" y2="12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="17.7" y1="4.5" x2="17.7" y2="12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M16 16.5V27.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'spoon':
      // Obědová lžička
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <ellipse
            cx="16"
            cy="10"
            rx="4.8"
            ry="6.2"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path
            d="M16 16.2V27.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M14 7.8C14.3 6.8 15 6.2 16 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'cloth':
      // Hadr na stůl (folded checkered cloth)
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect
            x="5"
            y="8"
            width="22"
            height="16"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <line x1="12.3" y1="8" x2="12.3" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="19.7" y1="8" x2="19.7" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="13.5" x2="27" y2="13.5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="18.8" x2="27" y2="18.8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="12.3" y="13.5" width="7.4" height="5.3" fill="currentColor" fillOpacity="0.32" />
        </svg>
      );

    case 'plate':
      // Talíř
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <circle
            cx="16"
            cy="16"
            r="11.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="1.8" fill="currentColor" />
        </svg>
      );

    case 'water':
      // Sklenice s vodou
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M8.5 6.5H23.5L21.5 26.5C21.4 27.3 20.7 28 19.9 28H12.1C11.3 28 10.6 27.3 10.5 26.5L8.5 6.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9.6 15C11.5 14 13.8 14 16 15C18.2 16 20.5 16 22.4 15L21.5 26.5H10.5L9.6 15Z"
            fill="currentColor"
            fillOpacity="0.28"
          />
          <path
            d="M9.7 15C11.8 13.9 14 14 16 15C18 16 20.2 16 22.3 15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="13" y="18" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.4" transform="rotate(14 14.7 19.7)" />
        </svg>
      );

    case 'beer':
      // Sklenice s pivem (Český půllitr)
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M8.5 11.5H20.5V26C20.5 27.1 19.6 28 18.5 28H10.5C9.4 28 8.5 27.1 8.5 26V11.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M20.5 14H23.5C24.9 14 26 15.1 26 16.5V21C26 22.4 24.9 23.5 23.5 23.5H20.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 11.5C7.2 9.8 8.2 7.8 10 7.6C10.8 5.8 13.2 5 15 6C16.8 5 19.2 5.8 19.8 7.8C21.4 8.2 22 10 21 11.5H8Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.35"
          />
          <line x1="12.5" y1="15" x2="12.5" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16.5" y1="15" x2="16.5" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'shot':
      // Panák
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M9.5 8.5H22.5L20.5 26.5H11.5L9.5 8.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M10.4 16H21.6L20.8 22H11.2L10.4 16Z"
            fill="currentColor"
            fillOpacity="0.32"
          />
          <line x1="11.2" y1="22.5" x2="20.8" y2="22.5" stroke="currentColor" strokeWidth="2" />
          <line x1="10.4" y1="16" x2="21.6" y2="16" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    case 'napkin':
      // Ubrousek (folded linen fan with ring)
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M16 4.5L9 25.5H23L16 4.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path d="M12.5 15L8 9.5L10.5 22" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M19.5 15L24 9.5L21.5 22" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <rect x="10.5" y="18.5" width="11" height="3.2" rx="1.6" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.35" />
        </svg>
      );

    case 'wine':
      // Láhev vína
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <path
            d="M13.5 4H18.5V9.8C18.5 11.2 21 12.6 21 15.2V26.5C21 27.3 20.3 28 19.5 28H12.5C11.7 28 11 27.3 11 26.5V15.2C11 12.6 13.5 11.2 13.5 9.8V4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <line x1="13" y1="7.5" x2="19" y2="7.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="12.8" y="16.5" width="6.4" height="6.5" rx="0.8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.22" />
        </svg>
      );
  }
};

/** Bespoke inline SVG Title Lockup Emblem for "Rytmus Stolu" */
export const TitleEmblem: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
    <circle cx="28" cy="28" r="25" stroke="#d99b38" strokeWidth="1.5" strokeOpacity="0.65" />
    <circle cx="28" cy="28" r="19" stroke="#f5efe6" strokeWidth="1.2" strokeOpacity="0.28" />
    {/* Fork left */}
    <path d="M18 16V23C18 24.8 19.2 26 21 26V39" stroke="#f5efe6" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 16V22.5M24 16V23C24 24.8 22.8 26 21 26" stroke="#f5efe6" strokeWidth="2" strokeLinecap="round" />
    {/* Musical eighth note beam connecting cutlery */}
    <path d="M29 34V18L39 15.5V31" stroke="#e2b86b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="26.8" cy="34.5" rx="3.2" ry="2.3" fill="#e2b86b" transform="rotate(-18 26.8 34.5)" />
    <ellipse cx="36.8" cy="31.5" rx="3.2" ry="2.3" fill="#e2b86b" transform="rotate(-18 36.8 31.5)" />
  </svg>
);
