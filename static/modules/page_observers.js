// 페이지 전환 시 히스토리 로드
const _comicPageObserver = new MutationObserver(() => {
  const page = document.getElementById('page-comic-gallery');
  if (page && page.classList.contains('active')) loadComicHistory();
});
if (document.getElementById('page-comic-gallery')) {
  _comicPageObserver.observe(document.getElementById('page-comic-gallery'), { attributes: true, attributeFilter: ['class'] });
}