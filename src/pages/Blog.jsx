import { Link } from "react-router";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import blogPosts from "../data/blogPosts";
import "./Blog.css";

function formatDate(iso) {
	if (!iso) return "";
	const d = new Date(iso + "T00:00:00");
	if (Number.isNaN(d.getTime())) return iso;
	return d
		.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
		.toUpperCase();
}

function BlogCard({ post }) {
	return (
		<Link to={`/blog/${post.id}`} className="blog-card hud">
			<span className="hud-corner-tr" />
			<span className="hud-corner-bl" />
			<div className="blog-card-image">
				<img src={post.image} alt="" loading="lazy" />
			</div>
			<div className="blog-card-body">
				<div className="blog-meta">
					<span className="author">{post.author}</span>
					<span className="sep">·</span>
					<span className="date">{formatDate(post.dateCreated)}</span>
					{post.lastEdited && <span className="blog-edited-chip">EDITED {formatDate(post.lastEdited)}</span>}
				</div>
				<h2 className="blog-card-title">{post.title}</h2>
				<p className="blog-card-excerpt">{post.excerpt}</p>
				<span className="blog-card-cta">
					READ <span className="arrow">→</span>
				</span>
			</div>
		</Link>
	);
}

function Blog() {
	const posts = [...blogPosts].sort((a, b) =>
		(b.dateCreated || "").localeCompare(a.dateCreated || "")
	);

	return (
		<Layout>
			<div className="page">
				<BackLink to="/" label="Back to Hub" />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// JOURNAL · FIELD_NOTES</span>
					<h1 className="hero-title flicker" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
						<span className="glitch" data-text="BLOG">BLOG</span>
					</h1>
					<p className="hero-subtitle">
						Notes from the practice room. Tone, technique, and the small
						decisions that compound into faster progress.
					</p>
				</header>

				<div className="section-stripe">
					<span className="label">// POSTS</span>
					<span className="rule" />
					<span className="count">{String(posts.length).padStart(2, "0")} ENTRIES</span>
				</div>

				{posts.length === 0 ? (
					<div className="blog-empty hud">
						<span className="hud-corner-tr" />
						<span className="hud-corner-bl" />
						// NO ENTRIES
					</div>
				) : (
					<div className="blog-list-grid">
						{posts.map((p) => <BlogCard key={p.id} post={p} />)}
					</div>
				)}
			</div>
		</Layout>
	);
}

export default Blog;
