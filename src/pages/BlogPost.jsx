import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { getPostById } from "../data/blogPosts";
import "./Blog.css";

function formatDate(iso) {
	if (!iso) return "";
	const d = new Date(iso + "T00:00:00");
	if (Number.isNaN(d.getTime())) return iso;
	return d
		.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
		.toUpperCase();
}

function renderBlock(block, i) {
	switch (block.type) {
		case "heading":
			return <h2 key={i}>{block.text}</h2>;
		case "paragraph":
			return <p key={i}>{block.text}</p>;
		case "image":
			return (
				<figure key={i}>
					<img src={block.src} alt={block.alt || ""} loading="lazy" />
					{block.caption && <figcaption>{block.caption}</figcaption>}
				</figure>
			);
		case "link":
			if (!block.youtubeId) return null;
			return (
				<figure key={i} className="blog-post-video">
					<div className="blog-post-video-frame">
						<iframe
							src={`https://www.youtube-nocookie.com/embed/${block.youtubeId}`}
							title={block.title || "YouTube video"}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
							loading="lazy"
						/>
					</div>
					{block.title && <figcaption>{block.title}</figcaption>}
				</figure>
			);
		default:
			return null;
	}
}

function BlogPost() {
	const { id } = useParams();
	const post = getPostById(id);

	if (!post) {
		return (
			<Layout>
				<div className="page">
					<BackLink to="/blog" label="Back to Blog" />
					<div className="blog-empty hud" style={{ marginTop: "2rem" }}>
						<span className="hud-corner-tr" />
						<span className="hud-corner-bl" />
						// ENTRY_NOT_FOUND ·{" "}
						<Link to="/blog" style={{ color: "var(--neon-cyan)" }}>
							RETURN TO INDEX
						</Link>
					</div>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="page">
				<BackLink to="/blog" label="Back to Blog" />

				<article className="blog-post">
					<header className="blog-post-header">
						<span className="eyebrow">// FIELD_NOTE · {formatDate(post.dateCreated)}</span>
						<h1 className="blog-post-title">{post.title}</h1>
						<div className="blog-meta">
							<span className="author">{post.author}</span>
							<span className="sep">·</span>
							<span className="date">{formatDate(post.dateCreated)}</span>
							{post.lastEdited && (
								<span className="blog-edited-chip">EDITED {formatDate(post.lastEdited)}</span>
							)}
						</div>
					</header>

					<div className="blog-post-hero hud">
						<span className="hud-corner-tr" />
						<span className="hud-corner-bl" />
						<img src={post.image} alt={post.title} />
					</div>

					<div className="blog-post-content">
						{post.content.map(renderBlock)}
					</div>

					<footer className="blog-post-footer">
						<span className="blog-meta">
							<span className="author">{post.author}</span>
							<span className="sep">·</span>
							<span className="date">{formatDate(post.dateCreated)}</span>
						</span>
						<Link to="/blog" className="blog-card-cta">
							<span className="arrow">←</span> ALL POSTS
						</Link>
					</footer>
				</article>
			</div>
		</Layout>
	);
}

export default BlogPost;
