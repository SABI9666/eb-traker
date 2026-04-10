
        function switchDesignerTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.doc-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Update content visibility
            document.getElementById('designer-drawings-content').style.display = 'none';
            document.getElementById('designer-specs-content').style.display = 'none';
            
            if (tabName === 'drawings') {
                document.getElementById('designer-drawings-content').style.display = 'block';
            } else {
                document.getElementById('designer-specs-content').style.display = 'block';
            }
        }

    