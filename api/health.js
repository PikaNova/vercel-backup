export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    source: "vercel",
    message: "Novora backup gateway is working"
  });
}
