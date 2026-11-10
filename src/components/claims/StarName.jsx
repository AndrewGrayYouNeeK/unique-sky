import { editionLabel } from '@/lib/dedication';

/**
 * Real catalog name first, always and unchanged; the buyer's edition name follows
 * as a badge: 'Sirius ★ Named by Alex – “Forever”'.
 */
export default function StarName({ name, owner, as = 'span', className = '', badgeClassName = '' }) {
  const Tag = /** @type {any} */ (as);
  return (
    <Tag className={className}>
      <span data-real-name>{name}</span>
      {owner && (
        <span data-edition className={`text-star-gold text-[0.8em] font-space font-normal ${badgeClassName}`}>
          {' ★ '}{editionLabel(owner)}
        </span>
      )}
    </Tag>
  );
}
