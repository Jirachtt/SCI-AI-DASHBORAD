export default function ProductPageHeader({
    icon: Icon,
    eyebrow,
    title,
    subtitle,
    actions,
    tone = 'emerald',
    className = '',
}) {
    return (
        <header className={`product-page-header product-page-header--${tone} ${className}`.trim()}>
            <div className="product-page-header-main">
                {Icon && (
                    <span className="product-page-header-icon" aria-hidden="true">
                        <Icon size={21} strokeWidth={2} />
                    </span>
                )}
                <div className="product-page-header-copy">
                    {eyebrow && <span className="product-page-header-eyebrow">{eyebrow}</span>}
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="product-page-header-actions">{actions}</div>}
        </header>
    );
}
